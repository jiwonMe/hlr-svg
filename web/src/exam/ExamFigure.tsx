import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Download, RotateCcw } from "lucide-react";
import { Camera } from "@hlr/camera/camera.js";
import { clamp, orbitFromCamera, orbitPosition } from "../runtime/orbit";
import { useDemoSvg } from "../runtime/useDemoSvg";
import { useFrameState } from "../runtime/useFrameState";
import { useRafLoop } from "../runtime/useRaf";
import {
  buildExamFigure,
  type ExamFigureModel,
  type FigureId,
} from "./figures";
import { lineRenderOptions, type HiddenLineMode } from "./lineStyle";
import "./exam.css";

const HiddenLineContext = createContext<HiddenLineMode>("dashed");
export const HiddenLineProvider = HiddenLineContext.Provider;
export type { HiddenLineMode };

type Offset = { azimuth: number; polar: number };
const ORIGIN: Offset = { azimuth: 0, polar: 0 };
/** After the reader turns a spinning figure, it waits this long to resume. */
const SPIN_RESUME_MS = 3500;
/** A spinning figure redraws at most this often. */
const SPIN_FRAME_S = 1 / 30;

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduce(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduce;
}

/** True while the element is on screen; off-screen figures stop animating. */
function useOnScreen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry?.isIntersecting ?? true),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return onScreen;
}

type Drag = {
  id: number;
  touch: boolean;
  x: number;
  y: number;
  start: Offset;
};

export type ExamFigureProps = {
  /** Names the downloaded file; also selects a built-in figure. */
  id: FigureId | (string & {});
  /** Builds a figure that is not one of the built-in exam figures. */
  build?: (width: number, height: number) => ExamFigureModel;
  /** Accessible description of the figure. */
  label: string;
  /** Height divided by width. */
  ratio?: number;
  /** Render immediately instead of waiting until the figure nears the viewport. */
  eager?: boolean;
  /** Static thumbnails skip rotation and the tool buttons. */
  interactive?: boolean;
  /** Turn slowly about the vertical axis, in radians per second. */
  spin?: number;
  className?: string;
};

function useMeasuredWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      // Re-rendering HLR on every pixel of a resize is wasted work.
      const next = Math.floor((entry?.contentRect.width ?? 0) / 4) * 4;
      setWidth((previous) => (previous === next ? previous : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function useNearViewport(
  ref: React.RefObject<HTMLElement | null>,
  eager: boolean,
): boolean {
  const [near, setNear] = useState(eager);
  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setNear(true);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, ref]);
  return near;
}

/** An HLR exam diagram, rendered at its displayed size and rotatable in place. */
export function ExamFigure({
  id,
  build,
  label,
  ratio = 0.75,
  eager = false,
  interactive = true,
  spin = 0,
  className = "",
}: ExamFigureProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const width = useMeasuredWidth(ref);
  const near = useNearViewport(ref, eager);
  const height = Math.round(width * ratio);
  return (
    <div
      ref={ref}
      className={`fig ${className}`}
      style={{ aspectRatio: `${1 / ratio}` }}
    >
      {width > 0 && near ? (
        <FigureCanvas
          id={id}
          build={build}
          label={label}
          width={width}
          height={height}
          interactive={interactive}
          spin={spin}
        />
      ) : (
        <div className="fig-pending" role="img" aria-label={label} />
      )}
    </div>
  );
}

function FigureCanvas({
  id,
  build,
  label,
  width,
  height,
  interactive,
  spin,
}: {
  id: string;
  build?: (width: number, height: number) => ExamFigureModel;
  label: string;
  width: number;
  height: number;
  interactive: boolean;
  spin: number;
}): React.ReactElement {
  const hintId = useId();
  const hiddenLines = useContext(HiddenLineContext);
  const model = useMemo(
    () =>
      build
        ? build(width, height)
        : buildExamFigure(id as FigureId, width, height),
    [build, id, width, height],
  );
  const baseCamera = model.demo.camera;
  const baseOrbit = useMemo(
    () => orbitFromCamera(baseCamera.position, baseCamera.target),
    [baseCamera],
  );
  // The rotation is kept relative to the authored view so a resize keeps it.
  const [offset, input] = useFrameState<Offset>(ORIGIN);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<Drag | null>(null);

  // A slow turntable: it pauses while the reader turns the figure, resumes a
  // moment later, and stops off screen or when reduced motion is preferred.
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const onScreen = useOnScreen(canvasRef);
  const reduceMotion = usePrefersReducedMotion();
  const lastTouched = useRef(-Infinity);
  const pending = useRef(0);
  const touched = () => {
    lastTouched.current = performance.now();
  };
  useRafLoop(
    interactive && spin > 0 && onScreen && !reduceMotion && !dragging,
    (elapsed) => {
      if (performance.now() - lastTouched.current < SPIN_RESUME_MS) return;
      pending.current += elapsed;
      if (pending.current < SPIN_FRAME_S) return;
      const turn = spin * pending.current;
      pending.current = 0;
      input.schedule((current) => ({
        ...current,
        azimuth: current.azimuth + turn,
      }));
    },
  );

  const camera = useMemo(() => {
    const orbit = {
      ...baseOrbit,
      azimuth: baseOrbit.azimuth + offset.azimuth,
      polar: clamp(0.08, baseOrbit.polar + offset.polar, Math.PI - 0.08),
    };
    const shared = {
      position: orbitPosition(orbit),
      target: orbit.target,
      up: baseCamera.up,
      aspect: baseCamera.aspect,
      near: baseCamera.near,
      far: baseCamera.far,
    };
    return baseCamera.kind === "orthographic"
      ? Camera.from({
          ...shared,
          kind: "orthographic",
          halfHeight: baseCamera.halfHeight!,
        })
      : Camera.from({
          ...shared,
          kind: "perspective",
          fovYRad: baseCamera.fovYRad!,
        });
  }, [baseCamera, baseOrbit, offset]);

  const demo = useMemo(() => ({ ...model.demo, camera }), [model, camera]);
  const lines = useDemoSvg(demo, lineRenderOptions(hiddenLines, dragging));
  const svg = useMemo(
    () =>
      lines.replace(
        /<\/svg>\s*$/,
        () => `${model.annotate(camera, width, height)}</svg>`,
      ),
    [lines, model, camera, width, height],
  );

  const rotated = offset.azimuth !== 0 || offset.polar !== 0;

  const reset = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    input.reset(ORIGIN);
  }, [input]);

  const end = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current?.id !== event.pointerId) return;
      input.flush();
      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [input],
  );

  const download = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `hlr-${id}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [id, svg]);

  if (!interactive)
    return (
      <div
        className="fig-canvas fig-static"
        role="img"
        aria-label={label}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );

  return (
    <>
      <div
        ref={canvasRef}
        className="fig-canvas"
        role="img"
        aria-label={label}
        aria-describedby={hintId}
        tabIndex={0}
        data-dragging={dragging || undefined}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          touched();
          dragRef.current = {
            id: event.pointerId,
            touch: event.pointerType === "touch",
            x: event.clientX,
            y: event.clientY,
            start: input.current(),
          };
          if (event.pointerType !== "touch") {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== event.pointerId) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          // Touch rotates horizontally only, so vertical swipes still scroll.
          if (drag.touch && !dragging) {
            if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }
          input.schedule({
            azimuth: drag.start.azimuth - dx * 0.008,
            polar: drag.touch
              ? drag.start.polar
              : drag.start.polar - dy * 0.008,
          });
        }}
        onPointerUp={(event) => {
          touched();
          end(event);
        }}
        onPointerCancel={end}
        onLostPointerCapture={() => {
          touched();
          input.flush();
          dragRef.current = null;
          setDragging(false);
        }}
        onKeyDown={(event) => {
          touched();
          if (event.key === "Home") {
            event.preventDefault();
            reset();
            return;
          }
          const step: Record<string, Offset> = {
            ArrowLeft: { azimuth: 0.12, polar: 0 },
            ArrowRight: { azimuth: -0.12, polar: 0 },
            ArrowUp: { azimuth: 0, polar: 0.12 },
            ArrowDown: { azimuth: 0, polar: -0.12 },
          };
          const delta = step[event.key];
          if (!delta) return;
          event.preventDefault();
          input.reset((current) => ({
            azimuth: current.azimuth + delta.azimuth,
            polar: current.polar + delta.polar,
          }));
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span id={hintId} className="sr-only">
        끌거나 방향키를 눌러 시점을 바꿀 수 있습니다. Home 키를 누르면 처음
        시점으로 돌아갑니다.
      </span>
      <div className="fig-tools" data-rotated={rotated || undefined}>
        <button
          type="button"
          onClick={reset}
          disabled={!rotated}
          aria-label="처음 시점으로 돌리기"
          title="처음 시점 (Home)"
        >
          <RotateCcw aria-hidden="true" size={13} strokeWidth={1.8} />
          <span>처음 시점</span>
        </button>
        <button
          type="button"
          onClick={download}
          aria-label="지금 보이는 그림을 SVG 파일로 저장"
          title="SVG로 저장"
        >
          <Download aria-hidden="true" size={13} strokeWidth={1.8} />
          <span>SVG</span>
        </button>
      </div>
    </>
  );
}
