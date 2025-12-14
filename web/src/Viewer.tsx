import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Slider from "@radix-ui/react-slider";

import { Camera } from "../../dist/camera/camera.js";
import { Vec3 } from "../../dist/math/vec3.js";
import { renderCaseToSvgString } from "../../dist/demo/renderCase.js";
import type { DemoCase } from "../../dist/demo/types.js";

import { orbitFromCamera, orbitPosition, type OrbitState, clamp } from "./runtime/orbit";
import { useRafTick } from "./runtime/useRaf";
import { StylePanel, type LineStyleState } from "./StylePanel";

type ViewerProps = {
  demo: DemoCase;
};

const ISO_AZ = Math.PI / 4; // 45°
const ISO_POLAR = Math.acos(1 / Math.sqrt(3)); // ~54.7356° from +Y
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

export function Viewer({ demo }: ViewerProps): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const baseOrbit = useMemo(() => orbitFromCamera(demo.camera.position, demo.camera.target), [demo]);
  const [orbit, setOrbit] = useState<OrbitState>(baseOrbit);
  const [povDeg, setPovDeg] = useState(() =>
    clamp(1, (demo.camera.fovYRad ?? (55 * Math.PI) / 180) * RAD2DEG, 90),
  );

  useEffect(() => {
    setOrbit(baseOrbit);
    setPovDeg(clamp(1, (demo.camera.fovYRad ?? (55 * Math.PI) / 180) * RAD2DEG, 90));
  }, [baseOrbit]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.6); // rad/sec
  const [style, setStyle] = useState<LineStyleState>(() => ({
    strokeVisible: "#000000",
    strokeHidden: "#000000",
    strokeWidthVisible: 1.8,
    strokeWidthHidden: 1.8,
    dashArrayHidden: "4 4",
    opacityHidden: 0.5,
    lineCap: "butt",
  }));

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
    return Camera.from({
      kind: "perspective",
      position: pos,
      target: orbit.target,
      up: demo.camera.up,
      fovYRad: clamp(1, povDeg, 120) * DEG2RAD,
      aspect,
      near: demo.camera.near,
      far: demo.camera.far,
    });
  }, [demo, orbit, povDeg, dirty]);

  const runtimeDemo = useMemo<DemoCase>(() => {
    // renderCaseToSvgString는 demo.camera를 사용하므로, camera만 바꿔 끼운다.
    return { ...demo, camera };
  }, [demo, camera]);

  const svg = useMemo(() => renderCaseToSvgString(runtimeDemo, { svgStyle: style }), [runtimeDemo, style]);

  return (
    <section className="caseCard">
      <div className="caseHeader">
        <div className="caseName">{demo.name}</div>
        <div className="caseActions">
          <button className="btn" type="button" onClick={() => setOrbit(baseOrbit)} title="카메라 리셋">
            리셋
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setOrbit((o) => ({ ...o, azimuth: ISO_AZ, polar: ISO_POLAR }));
              // "isometric" = perspective에서 FOV를 극단적으로 좁게 만든 상태로 취급
              // 프레이밍이 너무 변하지 않도록 거리도 함께 보정한다.
              setOrbit((o) => {
                const oldFov = clamp(1, povDeg, 120) * DEG2RAD;
                const newFov = 6 * DEG2RAD;
                const k = Math.tan(oldFov / 2) / Math.tan(newFov / 2);
                return { ...o, radius: clamp(0.2, o.radius * k, 200) };
              });
              setPovDeg(6);
              setDirty((x) => x + 1);
            }}
            title="표준 등각 뷰로 스냅"
          >
            등각
          </button>
          <button className="btn" type="button" onClick={() => setPlaying((p) => !p)} title="자동 회전">
            {playing ? "정지" : "재생"}
          </button>
          <StylePanel value={style} onChange={setStyle} />
          <button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(svg)} title="SVG 문자열 복사">
            SVG 복사
          </button>
        </div>
      </div>

      <div className="viewerBar">
        <div className="viewerHint">드래그: 회전 · 휠: 줌(거리) · POV: FOV</div>
        <label className="viewerLabel">
          POV
          <div className="viewerPovSlider">
            <Slider.Root
              className="radixSlider"
              min={1}
              max={85}
              step={1}
              value={[povDeg]}
              onValueChange={(v) => {
                const next = clamp(1, v[0] ?? povDeg, 85);
                // "isometric = FOV 극소" 취급이므로, FOV를 바꿔도 프레이밍이 너무 변하지 않게
                // radius를 tan(FOV/2)에 반비례하도록 보정한다.
                setOrbit((o) => {
                  const oldFov = clamp(1, povDeg, 120) * DEG2RAD;
                  const newFov = next * DEG2RAD;
                  const k = Math.tan(oldFov / 2) / Math.tan(newFov / 2);
                  return { ...o, radius: clamp(0.2, o.radius * k, 200) };
                });
                setPovDeg(next);
                setDirty((x) => x + 1);
              }}
              aria-label="POV (FOV)"
            >
              <Slider.Track className="radixSliderTrack">
                <Slider.Range className="radixSliderRange" />
              </Slider.Track>
              <Slider.Thumb className="radixSliderThumb" />
            </Slider.Root>
          </div>
          <span className="viewerPovValue">{Math.round(povDeg)}°</span>
        </label>
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
          setOrbit((o) => ({ ...o, radius: clamp(0.2, o.radius * k, 200) }));
          setDirty((x) => x + 1);
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </section>
  );
}


