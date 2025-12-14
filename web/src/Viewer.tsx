import React, { useEffect, useMemo, useRef, useState } from "react";

import { Camera } from "../../dist/camera/camera.js";
import { Vec3 } from "../../dist/math/vec3.js";
import { renderCaseToSvgString } from "../../dist/demo/renderCase.js";
import type { DemoCase } from "../../dist/demo/types.js";

import { orbitFromCamera, orbitPosition, type OrbitState, clamp } from "./runtime/orbit";
import { useRafTick } from "./runtime/useRaf";

type ViewerProps = {
  demo: DemoCase;
};

export function Viewer({ demo }: ViewerProps): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const baseOrbit = useMemo(() => orbitFromCamera(demo.camera.position, demo.camera.target), [demo]);
  const [orbit, setOrbit] = useState<OrbitState>(baseOrbit);

  useEffect(() => {
    setOrbit(baseOrbit);
  }, [baseOrbit]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.6); // rad/sec

  const [drag, setDrag] = useState<null | { x: number; y: number; az: number; pol: number; id: number }>(null);
  const [dirty, setDirty] = useState(0);
  const tick = useRafTick(playing);

  // auto orbit
  useEffect(() => {
    if (!playing) return;
    setOrbit((o) => ({ ...o, azimuth: o.azimuth + speed * (1 / 60) }));
  }, [tick, playing, speed]);

  const camera = useMemo(() => {
    const pos = orbitPosition(orbit);
    const aspect = demo.camera.aspect;
    if (demo.camera.kind === "perspective") {
      return Camera.from({
        kind: "perspective",
        position: pos,
        target: orbit.target,
        up: demo.camera.up,
        fovYRad: demo.camera.fovYRad ?? (55 * Math.PI) / 180,
        aspect,
        near: demo.camera.near,
        far: demo.camera.far,
      });
    }
    return Camera.from({
      kind: "orthographic",
      position: pos,
      target: orbit.target,
      up: demo.camera.up,
      halfHeight: demo.camera.halfHeight ?? 2,
      aspect,
      near: demo.camera.near,
      far: demo.camera.far,
    });
  }, [demo, orbit, dirty]);

  const runtimeDemo = useMemo<DemoCase>(() => {
    // renderCaseToSvgString는 demo.camera를 사용하므로, camera만 바꿔 끼운다.
    return { ...demo, camera };
  }, [demo, camera]);

  const svg = useMemo(() => renderCaseToSvgString(runtimeDemo), [runtimeDemo]);

  return (
    <section className="caseCard">
      <div className="caseHeader">
        <div className="caseName">{demo.name}</div>
        <div className="caseActions">
          <button className="btn" type="button" onClick={() => setOrbit(baseOrbit)} title="카메라 리셋">
            리셋
          </button>
          <button className="btn" type="button" onClick={() => setPlaying((p) => !p)} title="자동 회전">
            {playing ? "정지" : "재생"}
          </button>
          <button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(svg)} title="SVG 문자열 복사">
            SVG 복사
          </button>
        </div>
      </div>

      <div className="viewerBar">
        <div className="viewerHint">드래그: 회전 · 휠: 줌</div>
        <label className="viewerLabel">
          속도
          <input
            className="viewerRange"
            type="range"
            min={0}
            max={2.5}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>
      </div>

      <div
        ref={wrapRef}
        className="svgWrap svgWrapInteractive"
        onPointerDown={(e) => {
          const el = wrapRef.current;
          if (!el) return;
          el.setPointerCapture(e.pointerId);
          setDrag({ x: e.clientX, y: e.clientY, az: orbit.azimuth, pol: orbit.polar, id: e.pointerId });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          if (drag.id !== e.pointerId) return;
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          const s = 0.0075;
          const az = drag.az + dx * s;
          const pol = clamp(0.05, drag.pol + dy * s, Math.PI - 0.05);
          setOrbit((o) => ({ ...o, azimuth: az, polar: pol }));
          setDirty((x) => x + 1);
        }}
        onPointerUp={(e) => {
          if (!drag) return;
          if (drag.id !== e.pointerId) return;
          setDrag(null);
        }}
        onWheel={(e) => {
          e.preventDefault();
          const k = Math.exp(e.deltaY * 0.0012);
          setOrbit((o) => ({ ...o, radius: clamp(0.2, o.radius * k, 50) }));
          setDirty((x) => x + 1);
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </section>
  );
}


