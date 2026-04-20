import type {
  GpuPreviewFrame,
  GpuPreviewSurfaceMesh,
} from "../core/gpuPreview.js";

export type GpuPreviewRendererOptions = {
  container: HTMLElement;
  antialias?: boolean;
  maxResolution?: number;
};

type SurfaceBuffers = {
  vao: WebGLVertexArrayObject;
  positionBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
};

const LINE_VERTEX_STRIDE = 10 * 4;

export class GpuPreviewRenderer {
  private readonly container: HTMLElement;
  private readonly antialias: boolean;
  private readonly maxResolution: number;
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private initialized = false;
  private destroyed = false;
  private currentFrame: GpuPreviewFrame | null = null;

  private surfaceProgram: WebGLProgram | null = null;
  private lineProgram: WebGLProgram | null = null;
  private lineVao: WebGLVertexArrayObject | null = null;
  private lineVertexBuffer: WebGLBuffer | null = null;
  private lineIndexBuffer: WebGLBuffer | null = null;
  private readonly surfaceCache = new WeakMap<GpuPreviewSurfaceMesh, SurfaceBuffers>();
  private readonly ownedSurfaceBuffers = new Set<SurfaceBuffers>();

  constructor(opts: GpuPreviewRendererOptions) {
    this.container = opts.container;
    this.antialias = opts.antialias ?? true;
    this.maxResolution = opts.maxResolution ?? 2;
  }

  async init(): Promise<void> {
    if (this.initialized || this.destroyed) return;

    const canvas = document.createElement("canvas");
    canvas.dataset.hlrRenderer = "gpu-preview";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";

    const gl = canvas.getContext("webgl2", {
      antialias: this.antialias,
      alpha: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw new Error("WebGL2 is required for GPU preview rendering.");
    }

    this.canvas = canvas;
    this.gl = gl;
    this.surfaceProgram = createProgram(gl, SURFACE_VERTEX_SHADER, SURFACE_FRAGMENT_SHADER);
    this.lineProgram = createProgram(gl, LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER);

    this.lineVao = gl.createVertexArray();
    this.lineVertexBuffer = gl.createBuffer();
    this.lineIndexBuffer = gl.createBuffer();
    if (!this.lineVao || !this.lineVertexBuffer || !this.lineIndexBuffer) {
      throw new Error("Failed to allocate GPU preview buffers.");
    }

    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineIndexBuffer);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, LINE_VERTEX_STRIDE, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, LINE_VERTEX_STRIDE, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, LINE_VERTEX_STRIDE, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, LINE_VERTEX_STRIDE, 28);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, LINE_VERTEX_STRIDE, 32);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, LINE_VERTEX_STRIDE, 36);
    gl.bindVertexArray(null);

    this.container.replaceChildren(canvas);
    this.initialized = true;
  }

  async renderFrame(frame: GpuPreviewFrame): Promise<void> {
    this.currentFrame = frame;
    await this.init();
    if (this.destroyed || !this.gl || !this.canvas || !this.surfaceProgram || !this.lineProgram) {
      return;
    }

    const gl = this.gl;
    const resolution = this.getResolution();
    const targetWidth = Math.max(1, Math.round(frame.width * resolution));
    const targetHeight = Math.max(1, Math.round(frame.height * resolution));
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
    }

    gl.viewport(0, 0, targetWidth, targetHeight);
    gl.clearColor(1, 1, 1, frame.background ? 1 : 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);

    const hasSurfaces = frame.surfaces.length > 0;
    if (hasSurfaces) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.depthFunc(gl.LEQUAL);
      gl.colorMask(false, false, false, false);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
      this.drawSurfaces(frame);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.colorMask(true, true, true, true);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }

    if (frame.lines.segmentCount === 0) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    const dash = parseDashPattern(frame.style.dashArrayHidden);

    if (hasSurfaces) {
      this.drawLines(frame, {
        viewportWidth: targetWidth,
        viewportHeight: targetHeight,
        resolution,
        color: cssColorToRgba(frame.style.strokeVisible, 1),
        width: frame.style.strokeWidthVisible,
        useDash: false,
        dash,
        depthFunc: gl.LEQUAL,
      });
      this.drawLines(frame, {
        viewportWidth: targetWidth,
        viewportHeight: targetHeight,
        resolution,
        color: cssColorToRgba(
          frame.style.strokeHidden,
          frame.style.opacityHidden,
        ),
        width: frame.style.strokeWidthHidden,
        useDash: dash.dash > 0 && dash.gap > 0,
        dash,
        depthFunc: gl.GREATER,
      });
    } else {
      this.drawLines(frame, {
        viewportWidth: targetWidth,
        viewportHeight: targetHeight,
        resolution,
        color: cssColorToRgba(frame.style.strokeVisible, 1),
        width: frame.style.strokeWidthVisible,
        useDash: false,
        dash,
        depthFunc: gl.ALWAYS,
      });
    }
  }

  getFrame(): GpuPreviewFrame | null {
    return this.currentFrame;
  }

  getCanvasElement(): HTMLCanvasElement | null {
    return this.canvas;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    const gl = this.gl;
    if (gl) {
      for (const buffers of this.ownedSurfaceBuffers) {
        gl.deleteVertexArray(buffers.vao);
        gl.deleteBuffer(buffers.positionBuffer);
        gl.deleteBuffer(buffers.indexBuffer);
      }
      if (this.lineVao) gl.deleteVertexArray(this.lineVao);
      if (this.lineVertexBuffer) gl.deleteBuffer(this.lineVertexBuffer);
      if (this.lineIndexBuffer) gl.deleteBuffer(this.lineIndexBuffer);
      if (this.surfaceProgram) gl.deleteProgram(this.surfaceProgram);
      if (this.lineProgram) gl.deleteProgram(this.lineProgram);
    }

    if (this.canvas?.parentElement === this.container) {
      this.container.removeChild(this.canvas);
    }

    this.ownedSurfaceBuffers.clear();
    this.canvas = null;
    this.gl = null;
    this.surfaceProgram = null;
    this.lineProgram = null;
    this.lineVao = null;
    this.lineVertexBuffer = null;
    this.lineIndexBuffer = null;
    this.initialized = false;
  }

  private drawSurfaces(frame: GpuPreviewFrame): void {
    const gl = this.gl;
    const program = this.surfaceProgram;
    if (!gl || !program) return;

    gl.useProgram(program);
    const viewProjLoc = gl.getUniformLocation(program, "uViewProj");
    gl.uniformMatrix4fv(viewProjLoc, false, frame.viewProj);

    for (const surface of frame.surfaces) {
      const buffers = this.ensureSurfaceBuffers(surface);
      gl.bindVertexArray(buffers.vao);
      gl.drawElements(gl.TRIANGLES, buffers.indexCount, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }

  private drawLines(
    frame: GpuPreviewFrame,
    opts: {
      viewportWidth: number;
      viewportHeight: number;
      resolution: number;
      color: readonly [number, number, number, number];
      width: number;
      useDash: boolean;
      dash: { dash: number; gap: number };
      depthFunc: number;
    },
  ): void {
    const gl = this.gl;
    const program = this.lineProgram;
    const vao = this.lineVao;
    const vertexBuffer = this.lineVertexBuffer;
    const indexBuffer = this.lineIndexBuffer;
    if (!gl || !program || !vao || !vertexBuffer || !indexBuffer) return;

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, frame.lines.vertices, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, frame.lines.indices, gl.DYNAMIC_DRAW);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uViewProj"), false, frame.viewProj);
    gl.uniform2f(
      gl.getUniformLocation(program, "uViewport"),
      opts.viewportWidth,
      opts.viewportHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "uLineWidth"),
      Math.max(1, opts.width * opts.resolution),
    );
    gl.uniform4f(
      gl.getUniformLocation(program, "uColor"),
      opts.color[0],
      opts.color[1],
      opts.color[2],
      opts.color[3],
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "uDash"),
      opts.dash.dash,
      opts.dash.gap,
    );
    gl.uniform1i(
      gl.getUniformLocation(program, "uUseDash"),
      opts.useDash ? 1 : 0,
    );
    gl.depthFunc(opts.depthFunc);
    gl.drawElements(gl.TRIANGLES, frame.lines.indices.length, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  private ensureSurfaceBuffers(surface: GpuPreviewSurfaceMesh): SurfaceBuffers {
    const cached = this.surfaceCache.get(surface);
    if (cached) return cached;

    const gl = this.gl;
    if (!gl) throw new Error("GPU preview renderer is not initialized.");

    const vao = gl.createVertexArray();
    const positionBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vao || !positionBuffer || !indexBuffer) {
      throw new Error("Failed to allocate surface GPU buffers.");
    }

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, surface.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, surface.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    const buffers: SurfaceBuffers = {
      vao,
      positionBuffer,
      indexBuffer,
      indexCount: surface.indices.length,
    };
    this.surfaceCache.set(surface, buffers);
    this.ownedSurfaceBuffers.add(buffers);
    return buffers;
  }

  private getResolution(): number {
    if (typeof window === "undefined") return 1;
    return Math.max(1, Math.min(this.maxResolution, window.devicePixelRatio || 1));
  }
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Failed to create WebGL program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "Unknown program link error.";
    gl.deleteProgram(program);
    throw new Error(info);
  }

  return program;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create WebGL shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error.";
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
}

function parseDashPattern(dashArray: string): { dash: number; gap: number } {
  const values = dashArray
    .split(/[,\s]+/)
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return { dash: 0, gap: 0 };
  if (values.length === 1) return { dash: values[0]!, gap: values[0]! };
  return {
    dash: values[0]!,
    gap: values[1]!,
  };
}

function cssColorToRgba(
  color: string,
  alpha: number,
): readonly [number, number, number, number] {
  const parsed = parseColorString(resolveCssColor(color));
  if (!parsed) return [0, 0, 0, alpha];
  return [parsed[0], parsed[1], parsed[2], alpha];
}

let colorParserContext: CanvasRenderingContext2D | null = null;

function resolveCssColor(color: string): string {
  if (typeof document === "undefined") return color;
  if (!colorParserContext) {
    colorParserContext = document.createElement("canvas").getContext("2d");
  }
  if (!colorParserContext) return color;
  colorParserContext.fillStyle = "#000";
  colorParserContext.fillStyle = color;
  return colorParserContext.fillStyle;
}

function parseColorString(
  color: string,
): readonly [number, number, number] | null {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0]! + hex[0]!, 16) / 255,
        parseInt(hex[1]! + hex[1]!, 16) / 255,
        parseInt(hex[2]! + hex[2]!, 16) / 255,
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
      ];
    }
  }

  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const [r, g, b] = match[1]!
    .split(",")
    .slice(0, 3)
    .map((token) => Number(token.trim()) / 255);
  if ([r, g, b].some((value) => !Number.isFinite(value))) return null;
  return [r!, g!, b!];
}

const SURFACE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;

uniform mat4 uViewProj;

void main() {
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

const SURFACE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 outColor;

void main() {
  outColor = vec4(0.0);
}
`;

const LINE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aStart;
layout(location = 1) in vec3 aEnd;
layout(location = 2) in float aDistanceStart;
layout(location = 3) in float aDistanceEnd;
layout(location = 4) in float aSide;
layout(location = 5) in float aAlong;

uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uLineWidth;

out float vDistance;

void main() {
  vec4 clipStart = uViewProj * vec4(aStart, 1.0);
  vec4 clipEnd = uViewProj * vec4(aEnd, 1.0);

  float startW = max(abs(clipStart.w), 1e-5);
  float endW = max(abs(clipEnd.w), 1e-5);
  vec2 ndcStart = clipStart.xy / startW;
  vec2 ndcEnd = clipEnd.xy / endW;

  vec2 dirPx = (ndcEnd - ndcStart) * 0.5 * uViewport;
  float lenPx = length(dirPx);
  vec2 normalPx = lenPx > 1e-5
    ? normalize(vec2(-dirPx.y, dirPx.x))
    : vec2(0.0, 1.0);

  vec4 clip = mix(clipStart, clipEnd, aAlong);
  vec2 offsetNdc = normalPx * (uLineWidth * 0.5 * aSide) * 2.0 / uViewport;
  clip.xy += offsetNdc * clip.w;
  gl_Position = clip;
  vDistance = mix(aDistanceStart, aDistanceEnd, aAlong);
}
`;

const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec4 uColor;
uniform vec2 uDash;
uniform int uUseDash;

in float vDistance;

out vec4 outColor;

void main() {
  if (uUseDash == 1) {
    float cycle = uDash.x + uDash.y;
    if (cycle > 0.0) {
      float position = mod(vDistance, cycle);
      if (position > uDash.x) {
        discard;
      }
    }
  }

  outColor = uColor;
}
`;
