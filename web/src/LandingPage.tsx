import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./components/ui/button";
import { Letter3DSwap } from "./components/ui/letter-3d-swap";
import { cn } from "./lib/utils";
import { Github, BookOpen } from "lucide-react";

import { Camera } from "../../dist/camera/camera.js";
import { Vec3 } from "../../dist/math/vec3.js";
import { Sphere } from "../../dist/scene/primitives/sphere.js";
import { Cylinder } from "../../dist/scene/primitives/cylinder.js";
import { Cone } from "../../dist/scene/primitives/cone.js";
import { BoxAabb } from "../../dist/scene/primitives/boxAabb.js";
import type { DemoCase } from "../../dist/demo/types.js";
import {
  sphereSilhouetteToCubics3,
  cylinderSilhouetteToCubics3,
  coneSilhouetteToCubics3,
} from "../../dist/curves/builders.js";
import { renderCaseToSvgString } from "../../dist/demo/renderCase.js";
import { orbitFromCamera, orbitPosition, type OrbitState, clamp } from "./runtime/orbit";
import { useRafTick } from "./runtime/useRaf";

type PrimitiveType = "sphere" | "cylinder" | "cone" | "box";

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomVec3(min: number, max: number): Vec3 {
  return new Vec3(randomFloat(min, max), randomFloat(min, max), randomFloat(min, max));
}

function randomUnitVec3(): Vec3 {
  const x = randomFloat(-1, 1);
  const y = randomFloat(-1, 1);
  const z = randomFloat(-1, 1);
  return Vec3.normalize(new Vec3(x, y, z));
}

function lineToCubic3(p0: Vec3, p3: Vec3) {
  const d = Vec3.sub(p3, p0);
  const p1 = Vec3.add(p0, Vec3.mulScalar(d, 1 / 3));
  const p2 = Vec3.add(p0, Vec3.mulScalar(d, 2 / 3));
  return { p0, p1, p2, p3 };
}

function boxEdgesAsCubics(min: Vec3, max: Vec3) {
  const [x0, y0, z0] = [min.x, min.y, min.z];
  const [x1, y1, z1] = [max.x, max.y, max.z];
  const v = [
    new Vec3(x0, y0, z0), new Vec3(x1, y0, z0),
    new Vec3(x0, y1, z0), new Vec3(x1, y1, z0),
    new Vec3(x0, y0, z1), new Vec3(x1, y0, z1),
    new Vec3(x0, y1, z1), new Vec3(x1, y1, z1),
  ];
  const edges: [Vec3, Vec3][] = [
    [v[0], v[1]], [v[2], v[3]], [v[4], v[5]], [v[6], v[7]],
    [v[0], v[2]], [v[1], v[3]], [v[4], v[6]], [v[5], v[7]],
    [v[0], v[4]], [v[1], v[5]], [v[2], v[6]], [v[3], v[7]],
  ];
  return edges.map(([a, b]) => lineToCubic3(a, b));
}

function createRandomPrimitives(count: number) {
  const types: PrimitiveType[] = ["sphere", "cylinder", "cone", "box"];
  const primitives: (Sphere | Cylinder | Cone | BoxAabb)[] = [];

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)]!;
    const pos = randomVec3(-2, 2);
    const id = `prim_${i}`;

    if (type === "sphere") {
      primitives.push(new Sphere(id, pos, randomFloat(0.4, 1.2)));
    } else if (type === "cylinder") {
      const axis = randomUnitVec3();
      primitives.push(new Cylinder(id, pos, axis, randomFloat(1.0, 2.5), randomFloat(0.3, 0.8), "both"));
    } else if (type === "cone") {
      const axis = randomUnitVec3();
      primitives.push(new Cone(id, pos, axis, randomFloat(1.0, 2.5), randomFloat(0.4, 1.0), "base"));
    } else {
      const size = randomFloat(0.4, 1.0);
      const min = pos;
      const max = Vec3.add(pos, new Vec3(size, size * randomFloat(0.5, 1.5), size));
      primitives.push(new BoxAabb(id, min, max));
    }
  }
  return primitives;
}

function createRandomDemoCase(): DemoCase {
  const count = Math.floor(randomFloat(3, 6));
  const primitives = createRandomPrimitives(count);

  const width = typeof window !== "undefined" ? window.innerWidth : 1920;
  const height = typeof window !== "undefined" ? window.innerHeight : 1080;

  const cam = Camera.from({
    kind: "perspective",
    position: new Vec3(5, 3.5, 6),
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: (50 * Math.PI) / 180,
    aspect: width / height,
    near: 0.1,
    far: 100,
  });

  return {
    name: "Random Scene",
    width,
    height,
    camera: cam,
    primitives,
    includeIntersections: true,
    curves: ({ camera }) => {
      const curves: ReturnType<typeof sphereSilhouetteToCubics3>[] = [];
      for (const p of primitives) {
        if (p instanceof Sphere) {
          curves.push(...sphereSilhouetteToCubics3({
            cameraPos: camera.position, center: p.center, radius: p.radius
          }));
        } else if (p instanceof Cylinder) {
          curves.push(...cylinderSilhouetteToCubics3({
            cameraPos: camera.position, base: p.base, axis: p.axis, height: p.height, radius: p.radius
          }));
        } else if (p instanceof Cone) {
          curves.push(...coneSilhouetteToCubics3({
            cameraPos: camera.position, apex: p.apex, axis: p.axis, height: p.height, baseRadius: p.baseRadius
          }));
        } else if (p instanceof BoxAabb) {
          curves.push(...boxEdgesAsCubics(p.min, p.max));
        }
      }
      return curves.flat();
    },
  };
}

export function LandingPage(): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [demoCase, setDemoCase] = useState<DemoCase>(() => createRandomDemoCase());

  const baseOrbit = useMemo(
    () => orbitFromCamera(demoCase.camera.position, demoCase.camera.target),
    [demoCase]
  );
  const [orbit, setOrbit] = useState<OrbitState>(baseOrbit);
  const [playing, setPlaying] = useState(true);
  const [drag, setDrag] = useState<null | {
    x: number; y: number; az: number; pol: number; id: number
  }>(null);
  const [dirty, setDirty] = useState(0);

  const tick = useRafTick(playing);

  useEffect(() => {
    setOrbit(baseOrbit);
  }, [baseOrbit]);

  useEffect(() => {
    if (!playing) return;
    setOrbit((o) => ({ ...o, azimuth: o.azimuth + 0.008 }));
  }, [tick, playing]);

  const camera = useMemo(() => {
    const pos = orbitPosition(orbit);
    const width = typeof window !== "undefined" ? window.innerWidth : 1920;
    const height = typeof window !== "undefined" ? window.innerHeight : 1080;
    return Camera.from({
      kind: "perspective",
      position: pos,
      target: orbit.target,
      up: demoCase.camera.up,
      fovYRad: demoCase.camera.fovYRad ?? (50 * Math.PI) / 180,
      aspect: width / height,
      near: demoCase.camera.near,
      far: demoCase.camera.far,
    });
  }, [demoCase, orbit, dirty]);

  const runtimeDemo = useMemo<DemoCase>(
    () => ({ ...demoCase, camera }),
    [demoCase, camera]
  );

  const svg = useMemo(
    () => renderCaseToSvgString(runtimeDemo, {
      svgStyle: {
        strokeWidthVisible: 2,
        strokeWidthHidden: 2,
        dashArrayHidden: "6 6",
        strokeColorVisible: "#000000",
        strokeColorHidden: "#000000",
        opacityHidden: 0.4,
      },
    }),
    [runtimeDemo]
  );

  const handleGenerate = useCallback(() => {
    const newCase = createRandomDemoCase();
    setDemoCase(newCase);
    setPlaying(true);
  }, []);

  const handleSaveSvg = useCallback(() => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hlr-scene-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svg]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY, az: orbit.azimuth, pol: orbit.polar, id: e.pointerId });
    setPlaying(false);
  }, [orbit]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const s = 0.005;
    const az = drag.az + dx * s;
    const pol = clamp(0.1, drag.pol + dy * s, Math.PI - 0.1);
    setOrbit((o) => ({ ...o, azimuth: az, polar: pol }));
    setDirty((x) => x + 1);
  }, [drag]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    setDrag(null);
    setPlaying(true);
  }, [drag]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const k = Math.exp(e.deltaY * 0.001);
    setOrbit((o) => ({ ...o, radius: clamp(3, o.radius * k, 20) }));
    setDirty((x) => x + 1);
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cn(
        // Full screen container
        "relative w-screen h-screen overflow-hidden",
        // Cursor styles
        "cursor-grab active:cursor-grabbing",
        // Touch behavior
        "touch-none select-none"
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Background SVG */}
      <div
        className={cn(
          // Full coverage
          "absolute inset-0",
          // Background color
          "bg-white"
        )}
        dangerouslySetInnerHTML={{ __html: svg }}
        style={{
          // Make SVG fill the entire viewport
        }}
      />

      {/* Make SVG fill viewport */}
      <style>{`
        .relative > div:first-child svg {
          width: 100vw;
          height: 100vh;
          display: block;
        }
      `}</style>

      {/* Content overlay */}
      <div
        className={cn(
          // Positioning
          "absolute inset-0",
          // Flex centering
          "flex flex-col items-center justify-center",
          // Pointer events for children only
          "pointer-events-none"
        )}
      >
        {/* Title */}
        <div
          className={cn(
            // Typography
            "font-display tracking-tight uppercase",
            "text-4xl sm:text-5xl md:text-6xl lg:text-7xl",
            // Color
            "text-black",
            // Spacing
            "mb-6",
            // Leading
            "leading-[0.85]",
            // Flex layout for vertical stacking
            "flex flex-col"
          )}
        >
          <Letter3DSwap
            as="span"
            rotateDirection="top"
            staggerFrom="first"
            staggerDuration={0.03}
            mainClassName="font-bold cursor-pointer pointer-events-auto"
          >
            HLR:
          </Letter3DSwap>
          <Letter3DSwap
            as="span"
            rotateDirection="bottom"
            staggerFrom="first"
            staggerDuration={0.03}
            mainClassName="font-normal cursor-pointer pointer-events-auto"
          >
            HIDDEN
          </Letter3DSwap>
          <Letter3DSwap
            as="span"
            rotateDirection="top"
            staggerFrom="last"
            staggerDuration={0.03}
            mainClassName="font-normal cursor-pointer pointer-events-auto"
          >
            LINE
          </Letter3DSwap>
          <Letter3DSwap
            as="span"
            rotateDirection="bottom"
            staggerFrom="center"
            staggerDuration={0.03}
            mainClassName="font-normal cursor-pointer pointer-events-auto"
          >
            REMOVAL
          </Letter3DSwap>
        </div>

        {/* Buttons */}
        <div className={cn("flex flex-col items-center gap-2 pointer-events-auto")}>
          <div className={cn("flex items-center gap-3")}>
            <Button
              onClick={handleGenerate}
              onPointerDown={(e) => e.stopPropagation()}
              size="xl"
              className={cn(
                // Extra styling
                "rounded-2xl",
                "font-semibold tracking-wide"
              )}
            >
              regenerate
            </Button>
            <Button
              asChild
              variant="outline"
              size="xl"
              className={cn(
                // Extra styling
                "rounded-2xl",
                "font-semibold tracking-wide"
              )}
            >
              <Link
                to="/docs/quickstart"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <BookOpen className="w-5 h-5" />
                docs
              </Link>
            </Button>
          </div>
          <Button
            onClick={handleSaveSvg}
            onPointerDown={(e) => e.stopPropagation()}
            variant="link"
            className={cn(
              // Text color
              "text-black/60 hover:text-black",
              // Underline
              "underline-offset-4"
            )}
          >
            save as svg
          </Button>
        </div>

        {/* Instructions */}
        <p
          className={cn(
            // Typography
            "text-sm text-black/40",
            // Spacing
            "mt-8",
            // Width
            "max-w-md text-center"
          )}
        >
          Drag to rotate · Scroll to zoom
        </p>

        {/* Social Links */}
        <div
          className={cn(
            // Flex
            "flex items-center gap-4",
            // Spacing
            "mt-6",
            // Pointer events
            "pointer-events-auto"
          )}
        >
          <a
            href="https://github.com/jiwonMe/hlr-svg"
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              // Color
              "text-black/40 hover:text-black",
              // Transition
              "transition-colors"
            )}
            title="GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href="https://www.npmjs.com/package/hlr"
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              // Color
              "text-black/40 hover:text-black",
              // Transition
              "transition-colors"
            )}
            title="npm"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

