import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useId,
  useMemo,
  useRef,
} from "react";
import type { Camera } from "@hlr/camera/camera.js";
import {
  buildSurfaceBuffer,
  buildSurfaceClipPaths,
  lightDirectionFromAngles,
  shadeSurfaceBuffer,
} from "@hlr/core/surfaceRenderer.js";
import type { Primitive } from "@hlr/scene/primitive.js";
import { Scene } from "@hlr/scene/scene.js";
import "./surface-diagram.css";

export type SurfaceDiagramHandle = { toSvg(): string };

export type SurfaceDiagramProps = {
  primitives: readonly Primitive[];
  camera: Camera;
  width: number;
  height: number;
  lineSvg: string;
  lighting: {
    enabled: boolean;
    azimuth: number;
    elevation: number;
    ambient: number;
  };
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
  onWheel?: React.WheelEventHandler<HTMLDivElement>;
  interactive?: boolean;
  className?: string;
  ariaLabel?: string;
};

function withoutBackground(source: string): string {
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = doc.documentElement;
  for (const child of [...svg.children]) {
    if (
      child.tagName === "rect" &&
      child.getAttribute("width") === "100%" &&
      child.getAttribute("height") === "100%"
    )
      child.remove();
  }
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");
  return new XMLSerializer().serializeToString(svg);
}

export const SurfaceDiagram = forwardRef<
  SurfaceDiagramHandle,
  SurfaceDiagramProps
>(function SurfaceDiagram(
  {
    primitives,
    camera,
    width,
    height,
    lineSvg,
    lighting,
    selectedId = null,
    onSelect,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onWheel,
    interactive = false,
    className = "",
    ariaLabel = "입체도형. 드래그로 회전하고 휠로 확대하며 클릭으로 객체를 선택할 수 있습니다.",
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const clipPrefix = `surface-${useId().replace(/:/g, "")}`;
  const { enabled, azimuth, elevation, ambient } = lighting;
  const resolution = Math.min(
    1,
    (interactive ? 320 : 720) / Math.max(width, height),
  );
  const rasterWidth = Math.max(1, Math.round(width * resolution));
  const rasterHeight = Math.max(1, Math.round(height * resolution));
  const buffer = useMemo(
    () =>
      enabled
        ? buildSurfaceBuffer(primitives, camera, {
            width: rasterWidth,
            height: rasterHeight,
          })
        : null,
    [primitives, camera, rasterWidth, rasterHeight, enabled],
  );
  const pixels = useMemo(
    () =>
      buffer
        ? shadeSurfaceBuffer(buffer, {
            lightDirection: lightDirectionFromAngles(azimuth, elevation),
            ambient,
            selectedId,
          })
        : null,
    [buffer, azimuth, elevation, ambient, selectedId],
  );
  const clipPaths = useMemo(
    () => (buffer ? buildSurfaceClipPaths(buffer, { width, height }) : []),
    [buffer, width, height],
  );
  const lines = useMemo(() => withoutBackground(lineSvg), [lineSvg]);
  const pickingScene = useMemo(
    () => new Scene(primitives, camera),
    [primitives, camera],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pixels)
      ctx.putImageData(
        new ImageData(new Uint8ClampedArray(pixels), rasterWidth, rasterHeight),
        0,
        0,
      );
  }, [pixels, rasterWidth, rasterHeight]);

  // React wheel listeners can be passive; a native listener lets zoom stop page scrolling.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !onWheel) return;
    const stopScroll = (event: WheelEvent) => event.preventDefault();
    wrapper.addEventListener("wheel", stopScroll, { passive: false });
    return () => wrapper.removeEventListener("wheel", stopScroll);
  }, [onWheel]);

  useImperativeHandle(
    ref,
    () => ({
      toSvg() {
        const doc = new DOMParser().parseFromString(lineSvg, "image/svg+xml");
        const svg = doc.documentElement;
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        if (enabled && buffer) {
          const exportCanvas = document.createElement("canvas");
          exportCanvas.width = rasterWidth;
          exportCanvas.height = rasterHeight;
          const ns = "http://www.w3.org/2000/svg";
          const defs = doc.createElementNS(ns, "defs");
          const surfaces = doc.createElementNS(ns, "g");
          const ctx = exportCanvas.getContext("2d");
          for (let index = 0; index < clipPaths.length; index++) {
            const { primitiveId, path: visiblePath } = clipPaths[index]!;
            if (!visiblePath || !ctx) continue;
            const clipId = `${clipPrefix}-${index}`;
            const clip = doc.createElementNS(ns, "clipPath");
            clip.setAttribute("id", clipId);
            clip.setAttribute("clipPathUnits", "userSpaceOnUse");
            const path = doc.createElementNS(ns, "path");
            path.setAttribute("d", visiblePath);
            clip.appendChild(path);
            defs.appendChild(clip);

            // Shade the entire projected object, then clip it to the nearest
            // surface region. Occlusion never changes its lighting coordinates.
            const fullSurface = buildSurfaceBuffer(
              primitives.filter((primitive) => primitive.id === primitiveId),
              camera,
              {
                width: rasterWidth,
                height: rasterHeight,
              },
            );
            const fullPixels = shadeSurfaceBuffer(fullSurface, {
              lightDirection: lightDirectionFromAngles(azimuth, elevation),
              ambient,
              selectedId,
            });
            ctx.putImageData(
              new ImageData(
                new Uint8ClampedArray(fullPixels),
                rasterWidth,
                rasterHeight,
              ),
              0,
              0,
            );
            const image = doc.createElementNS(ns, "image");
            image.setAttribute("width", String(width));
            image.setAttribute("height", String(height));
            image.setAttribute("preserveAspectRatio", "none");
            image.setAttribute("href", exportCanvas.toDataURL("image/png"));
            image.setAttribute("clip-path", `url(#${clipId})`);
            image.setAttribute("data-primitive-id", primitiveId);
            surfaces.appendChild(image);
          }
          let background = [...svg.children].find(
            (child) => child.tagName === "rect",
          );
          if (!background) {
            background = doc.createElementNS(
              "http://www.w3.org/2000/svg",
              "rect",
            );
            background.setAttribute("width", "100%");
            background.setAttribute("height", "100%");
            background.setAttribute("fill", "white");
            svg.insertBefore(background, svg.firstChild);
          }
          svg.insertBefore(defs, svg.firstChild);
          svg.insertBefore(
            surfaces,
            background ? background.nextSibling : svg.firstChild,
          );
        }
        return new XMLSerializer().serializeToString(svg);
      },
    }),
    [
      lineSvg,
      enabled,
      buffer,
      clipPaths,
      clipPrefix,
      primitives,
      camera,
      azimuth,
      elevation,
      ambient,
      selectedId,
      rasterWidth,
      rasterHeight,
      width,
      height,
    ],
  );

  return (
    <div
      ref={wrapperRef}
      className={`surface-diagram ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        pressRef.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        onPointerDown?.(event);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        const press = pressRef.current;
        if (
          press &&
          Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5 &&
          onSelect
        ) {
          const rect = event.currentTarget.getBoundingClientRect();
          const ray = camera.screenToRay(
            ((event.clientX - rect.left) * width) / rect.width,
            ((event.clientY - rect.top) * height) / rect.height,
            width,
            height,
          );
          const directionalDepth =
            ray.dir.x * camera.forward.x +
            ray.dir.y * camera.forward.y +
            ray.dir.z * camera.forward.z;
          const tMin =
            camera.kind === "perspective" ? camera.near / directionalDepth : 0;
          const tMax =
            camera.kind === "perspective"
              ? camera.far / directionalDepth
              : camera.far - camera.near;
          onSelect(
            pickingScene.raycastClosest(ray, { tMin, tMax })?.primitiveId ??
              null,
          );
        }
        pressRef.current = null;
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        pressRef.current = null;
        onPointerCancel?.(event);
      }}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        width={rasterWidth}
        height={rasterHeight}
        aria-hidden="true"
      />
      <div
        className="surface-diagram-lines"
        dangerouslySetInnerHTML={{ __html: lines }}
      />
    </div>
  );
});
