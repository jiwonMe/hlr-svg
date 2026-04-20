import {
  Container,
  Graphics,
  WebGLRenderer as PixiWebGLRenderer,
} from "pixi.js";

import {
  snapshotToSvg,
  type ProjectedCubic,
  type ProjectedPoint,
  type RenderSnapshot,
  type SnapshotPath,
} from "../core/renderSnapshot.js";

export type WebglRendererOptions = {
  container: HTMLElement;
  antialias?: boolean;
  maxResolution?: number;
};

export class WebglRenderer {
  private readonly container: HTMLElement;
  private readonly antialias: boolean;
  private readonly maxResolution: number;
  private readonly root: Container;
  private readonly renderer: PixiWebGLRenderer;
  private initPromise: Promise<void> | null = null;
  private destroyed = false;
  private initialized = false;
  private rendererDestroyed = false;
  private currentSnapshot: RenderSnapshot | null = null;

  constructor(opts: WebglRendererOptions) {
    this.container = opts.container;
    this.antialias = opts.antialias ?? true;
    this.maxResolution = opts.maxResolution ?? 2;
    this.root = new Container();
    this.renderer = new PixiWebGLRenderer();
  }

  async init(): Promise<void> {
    if (this.destroyed) return;
    if (!this.initPromise) {
      this.initPromise = this.renderer
        .init({
          width: 1,
          height: 1,
          antialias: this.antialias,
          autoDensity: true,
          backgroundAlpha: 0,
          clearBeforeRender: true,
          hello: false,
          resolution: this.getResolution(),
        })
        .then(() => {
          this.initialized = true;
          if (this.destroyed) {
            this.destroyRenderer();
            return;
          }
          this.mountCanvas();
        });
    }

    await this.initPromise;
  }

  async renderSnapshot(snapshot: RenderSnapshot): Promise<void> {
    this.currentSnapshot = snapshot;
    await this.init();
    if (this.destroyed || !this.initPromise) return;

    const current = this.currentSnapshot;
    if (!current) return;

    this.renderer.resize(
      current.width,
      current.height,
      this.getResolution(),
    );
    this.clearRoot();

    if (current.background) {
      const bg = new Graphics();
      bg.rect(0, 0, current.width, current.height).fill({
        color: 0xffffff,
        alpha: 1,
      });
      this.root.addChild(bg);
    }

    for (const path of current.paths) {
      if (path.cubics.length === 0) continue;
      const graphics = new Graphics();
      if (path.visible || !path.dashArray) {
        drawBezierPath(graphics, path);
      } else {
        drawDashedPath(graphics, path);
      }
      this.root.addChild(graphics);
    }

    this.renderer.render({
      container: this.root,
      clear: true,
      clearColor: [0, 0, 0, 0],
    });
  }

  exportSvg(): string | null {
    return this.currentSnapshot ? snapshotToSvg(this.currentSnapshot) : null;
  }

  getSnapshot(): RenderSnapshot | null {
    return this.currentSnapshot;
  }

  getCanvasElement(): HTMLCanvasElement | null {
    return this.initialized ? this.renderer.canvas : null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearRoot();
    if (this.initialized) {
      this.destroyRenderer();
      return;
    }

    void this.initPromise
      ?.then(() => {
        if (this.destroyed) this.destroyRenderer();
      })
      .catch(() => {});
  }

  private clearRoot(): void {
    const children = this.root.removeChildren();
    for (const child of children) {
      child.destroy({ children: true });
    }
  }

  private destroyRenderer(): void {
    if (this.rendererDestroyed) return;
    this.rendererDestroyed = true;
    if (this.renderer.canvas.parentElement === this.container) {
      this.container.removeChild(this.renderer.canvas);
    }
    this.root.destroy({ children: true });
    this.renderer.destroy(false);
  }

  private getResolution(): number {
    if (typeof window === "undefined") return 1;
    return Math.max(1, Math.min(this.maxResolution, window.devicePixelRatio || 1));
  }

  private mountCanvas(): void {
    const canvas = this.renderer.canvas;
    canvas.dataset.hlrRenderer = "exact-webgl";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    if (canvas.parentElement !== this.container) {
      this.container.replaceChildren(canvas);
    }
  }
}

function drawBezierPath(graphics: Graphics, path: SnapshotPath): void {
  const first = path.cubics[0];
  if (!first) return;

  graphics.moveTo(first.p0.x, first.p0.y);
  for (const cubic of path.cubics) {
    graphics.bezierCurveTo(
      cubic.p1.x,
      cubic.p1.y,
      cubic.p2.x,
      cubic.p2.y,
      cubic.p3.x,
      cubic.p3.y,
    );
  }
  graphics.stroke(toStrokeStyle(path));
}

function drawDashedPath(graphics: Graphics, path: SnapshotPath): void {
  const dashPattern = parseDashArray(path.dashArray);
  if (dashPattern.length === 0) {
    drawBezierPath(graphics, path);
    return;
  }

  const points = flattenPath(path.cubics);
  if (points.length < 2) return;

  let patternIndex = 0;
  let remaining = dashPattern[0]!;
  let draw = true;

  for (let i = 1; i < points.length; i++) {
    let start = points[i - 1]!;
    const end = points[i]!;
    let segDx = end.x - start.x;
    let segDy = end.y - start.y;
    let segLen = Math.hypot(segDx, segDy);

    while (segLen > 1e-6) {
      const step = Math.min(remaining, segLen);
      const ratio = segLen <= 0 ? 0 : step / segLen;
      const next = {
        x: start.x + segDx * ratio,
        y: start.y + segDy * ratio,
        z: start.z + (end.z - start.z) * ratio,
      };

      if (draw) {
        graphics.moveTo(start.x, start.y);
        graphics.lineTo(next.x, next.y);
      }

      start = next;
      segDx = end.x - start.x;
      segDy = end.y - start.y;
      segLen = Math.hypot(segDx, segDy);
      remaining -= step;

      if (remaining <= 1e-6) {
        patternIndex = (patternIndex + 1) % dashPattern.length;
        remaining = dashPattern[patternIndex]!;
        draw = !draw;
      }
    }
  }

  graphics.stroke(toStrokeStyle(path));
}

function flattenPath(cubics: readonly ProjectedCubic[]): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];

  for (const cubic of cubics) {
    if (points.length === 0) points.push(cubic.p0);
    const approxLength =
      distance(cubic.p0, cubic.p1) +
      distance(cubic.p1, cubic.p2) +
      distance(cubic.p2, cubic.p3);
    const steps = clampInt(8, Math.ceil(approxLength / 12), 96);

    for (let i = 1; i <= steps; i++) {
      points.push(evalProjectedCubic(cubic, i / steps));
    }
  }

  return points;
}

function evalProjectedCubic(cubic: ProjectedCubic, t: number): ProjectedPoint {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  const w0 = mt2 * mt;
  const w1 = 3 * mt2 * t;
  const w2 = 3 * mt * t2;
  const w3 = t2 * t;

  return {
    x: cubic.p0.x * w0 + cubic.p1.x * w1 + cubic.p2.x * w2 + cubic.p3.x * w3,
    y: cubic.p0.y * w0 + cubic.p1.y * w1 + cubic.p2.y * w2 + cubic.p3.y * w3,
    z: cubic.p0.z * w0 + cubic.p1.z * w1 + cubic.p2.z * w2 + cubic.p3.z * w3,
  };
}

function parseDashArray(dashArray: string | undefined): number[] {
  if (!dashArray) return [];
  const values = dashArray
    .split(/[,\s]+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) return [];
  if (values.length % 2 === 1) return [...values, ...values];
  return values;
}

function toStrokeStyle(path: SnapshotPath): {
  width: number;
  color: string;
  alpha: number;
  cap: SnapshotPath["lineCap"];
  join: SnapshotPath["lineJoin"];
  alignment: number;
} {
  return {
    width: path.strokeWidth,
    color: path.stroke,
    alpha: path.opacity,
    cap: path.lineCap,
    join: path.lineJoin,
    alignment: 0.5,
  };
}

function distance(a: ProjectedPoint, b: ProjectedPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function clampInt(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
