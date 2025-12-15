import React, { useEffect, useMemo, useRef, useState } from "react";

import { Camera } from "../../dist/camera/camera.js";
import { Vec3 } from "../../dist/math/vec3.js";
import { renderCaseToSvgString, renderCaseToSvgStringProfiled } from "../../dist/demo/renderCase.js";
import type { DemoCase } from "../../dist/demo/types.js";
import { formatProfileReport, type ProfileReport } from "../../dist/core/profiler.js";

import { orbitFromCamera, orbitPosition, type OrbitState, clamp } from "./runtime/orbit";
import { useRafTick } from "./runtime/useRaf";
import { StylePanel, type LineStyleState } from "./StylePanel";

type ViewerProps = {
  demo: DemoCase;
};

type Projection = "perspective" | "isometric";

const ISO_AZ = Math.PI / 4; // 45°
const ISO_POLAR = Math.acos(1 / Math.sqrt(3)); // ~54.7356° from +Y
const COARSE_PRESETS = [0, 48, 64, 96] as const;
type CoarsePresetIndex = 0 | 1 | 2 | 3;

export function Viewer({ demo }: ViewerProps): React.ReactElement {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const baseOrbit = useMemo(() => orbitFromCamera(demo.camera.position, demo.camera.target), [demo]);
  const [orbit, setOrbit] = useState<OrbitState>(baseOrbit);
  const [projection, setProjection] = useState<Projection>("perspective");
  const [orthoHalfHeight, setOrthoHalfHeight] = useState(() => clamp(0.2, baseOrbit.radius * 0.55, 10));
  const [profileOn, setProfileOn] = useState(false);
  const [profileText, setProfileText] = useState("");
  const [coarseIdx, setCoarseIdx] = useState<CoarsePresetIndex>(2); // default: 64

  useEffect(() => {
    setOrbit(baseOrbit);
    setProjection("perspective");
    setOrthoHalfHeight(clamp(0.2, baseOrbit.radius * 0.55, 10));
    setProfileOn(false);
    setProfileText("");
    setCoarseIdx(2);
  }, [baseOrbit]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.6); // rad/sec
  const [style, setStyle] = useState<LineStyleState>(() => ({
    strokeVisible: "#000000",
    strokeHidden: "#000000",
    strokeWidthVisible: 1.8,
    strokeWidthHidden: 1.8,
    dashArrayHidden: "4 4",
    opacityHidden: 1,
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
    if (projection === "perspective") {
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
      halfHeight: orthoHalfHeight,
      aspect,
      near: demo.camera.near,
      far: demo.camera.far,
    });
  }, [demo, orbit, orthoHalfHeight, projection, dirty]);

  const runtimeDemo = useMemo<DemoCase>(() => {
    // renderCaseToSvgString는 demo.camera를 사용하므로, camera만 바꿔 끼운다.
    return { ...demo, camera };
  }, [demo, camera]);

  const coarseSamples = COARSE_PRESETS[coarseIdx] ?? 64;

  const profiled = useMemo((): { svg: string; report: ProfileReport | null } => {
    if (!profileOn) {
      return {
        svg: renderCaseToSvgString(runtimeDemo, { svgStyle: style, hlr: { coarseSamples } }),
        report: null,
      };
    }
    return renderCaseToSvgStringProfiled(runtimeDemo, { svgStyle: style, hlr: { coarseSamples } });
  }, [coarseSamples, profileOn, runtimeDemo, style]);

  const svg = profiled.svg;

  useEffect(() => {
    if (!profileOn || !profiled.report) {
      setProfileText("");
      return;
    }
    const text = formatProfileReport(profiled.report);
    setProfileText(text);
    // 한 번에 보기 좋게 콘솔에도 찍어둔다(렌더 1회마다 1로그)
    // eslint-disable-next-line no-console
    console.log(`[hlr-svg profile] ${demo.name}\n${text}`);
  }, [demo.name, profileOn, profiled.report]);

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
              setProjection("isometric");
              setOrbit((o) => ({ ...o, azimuth: ISO_AZ, polar: ISO_POLAR }));
              setOrthoHalfHeight(clamp(0.2, baseOrbit.radius * 0.55, 10));
              setDirty((x) => x + 1);
            }}
            title="표준 등각 뷰로 스냅"
          >
            등각
          </button>
          <button className="btn" type="button" onClick={() => setPlaying((p) => !p)} title="자동 회전">
            {playing ? "정지" : "재생"}
          </button>
          <button
            className={profileOn ? "btn btnActive" : "btn"}
            type="button"
            onClick={() => setProfileOn((v) => !v)}
            title="렌더 프로파일링(타이밍/카운트) 토글"
          >
            Profile
          </button>
          <StylePanel value={style} onChange={setStyle} />
          <button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(svg)} title="SVG 문자열 복사">
            SVG 복사
          </button>
        </div>
      </div>

      <div className="viewerBar">
        <div className="viewerHint">
          드래그: 회전 · 휠: {projection === "perspective" ? "줌(거리)" : "줌(스케일)"}
        </div>
        <div className="segmented" role="tablist" aria-label="투영 모드">
          <button
            className={projection === "perspective" ? "segBtn segBtnActive" : "segBtn"}
            type="button"
            role="tab"
            aria-selected={projection === "perspective"}
            onClick={() => setProjection("perspective")}
          >
            Perspective
          </button>
          <button
            className={projection === "isometric" ? "segBtn segBtnActive" : "segBtn"}
            type="button"
            role="tab"
            aria-selected={projection === "isometric"}
            onClick={() => {
              setProjection("isometric");
              setOrbit((o) => ({ ...o, azimuth: ISO_AZ, polar: ISO_POLAR }));
              setOrthoHalfHeight((h) => clamp(0.2, h, 20));
              setDirty((x) => x + 1);
            }}
          >
            Isometric
          </button>
        </div>
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

        <label className="viewerLabel" title="HLR coarseSamples(0=끔, 값이 클수록 더 정확/느림)">
          coarse
          <input
            className="viewerRange"
            type="range"
            min={0}
            max={3}
            step={1}
            value={coarseIdx}
            onChange={(e) => setCoarseIdx(Number(e.target.value) as CoarsePresetIndex)}
          />
          <span className="viewerPovValue">{coarseSamples}</span>
        </label>
      </div>

      {profileOn && profileText ? (
        <div className="profileRow">
          <pre className="profileBox">{profileText}</pre>
        </div>
      ) : null}

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
          if (projection === "perspective") {
            setOrbit((o) => ({ ...o, radius: clamp(0.2, o.radius * k, 50) }));
          } else {
            setOrthoHalfHeight((h) => clamp(0.15, h * k, 50));
          }
          setDirty((x) => x + 1);
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </section>
  );
}


