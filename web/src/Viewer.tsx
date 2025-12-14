import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Slider from "@radix-ui/react-slider";

import { Camera, Scene, Vec3 } from "../../dist/index.js";
import { renderCaseToSvgString } from "../../dist/demo/renderCase.js";
import type { DemoCase } from "../../dist/demo/types.js";

import { orbitFromCamera, orbitPosition, type OrbitState, clamp } from "./runtime/orbit";
import { useRafTick } from "./runtime/useRaf";
import { StylePanel, type LineStyleState } from "./StylePanel";
import { ObjectSelector } from "./ObjectSelector";
import { renderHighlightSvg } from "./highlight";

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
  }, [baseOrbit, demo.camera.fovYRad]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.6); // rad/sec
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [style, setStyle] = useState<LineStyleState>(() => ({
    strokeVisible: "#000000",
    strokeHidden: "#000000",
    strokeWidthVisible: 1.8,
    strokeWidthHidden: 1.8,
    dashArrayHidden: "4 4",
    opacityHidden: 0.5,
    lineCap: "butt",
  }));

  const [drag, setDrag] = useState<null | {
    x: number;
    y: number;
    az: number;
    pol: number;
    id: number;
    moved: boolean;
  }>(null);
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

  const runtimeDemo = useMemo<DemoCase>(() => ({ ...demo, camera }), [demo, camera]);

  const svg = useMemo(() => renderCaseToSvgString(runtimeDemo, { svgStyle: style as any }), [runtimeDemo, style]);
  const highlightSvg = useMemo(() => {
    if (!selectedId) return "";
    return renderHighlightSvg(runtimeDemo, selectedId, style as any);
  }, [runtimeDemo, selectedId, style]);

  const pickAtClientPoint = (clientX: number, clientY: number): string | null => {
    const root = wrapRef.current;
    if (!root) return null;

    // base svg를 기준으로 클릭 좌표를 viewBox 좌표로 변환
    const svgEl = root.querySelector("svg");
    if (!svgEl) return null;
    const r = svgEl.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return null;

    const sx = ((clientX - r.left) / r.width) * runtimeDemo.width;
    const sy = ((clientY - r.top) / r.height) * runtimeDemo.height;

    // NDC
    const ndcX = (sx / runtimeDemo.width) * 2 - 1;
    const ndcY = 1 - (sy / runtimeDemo.height) * 2;

    // ray dir in world
    const fovY = clamp(1, povDeg, 120) * DEG2RAD;
    const tan = Math.tan(fovY / 2);

    const forward = runtimeDemo.camera.forward;
    const right = Vec3.normalize(Vec3.cross(forward, runtimeDemo.camera.up));
    const up2 = Vec3.normalize(Vec3.cross(right, forward));

    const dir = Vec3.normalize(
      Vec3.add(
        forward,
        Vec3.add(
          Vec3.mulScalar(right, ndcX * tan * runtimeDemo.camera.aspect),
          Vec3.mulScalar(up2, ndcY * tan),
        ),
      ),
    );

    const scene = new Scene(runtimeDemo.primitives);
    const rayScene = scene.toRaycastScene(runtimeDemo.camera);
    const hit = rayScene.raycastClosest(
      { origin: runtimeDemo.camera.position, dir },
      { tMin: 0, tMax: Number.POSITIVE_INFINITY },
    );
    return hit ? (hit.primitiveId as string) : null;
  };

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
              setOrbit((o) => {
                const oldFov = clamp(1, povDeg, 120) * DEG2RAD;
                const newFov = 6 * DEG2RAD;
                const k = Math.tan(oldFov / 2) / Math.tan(newFov / 2);
                return { ...o, radius: clamp(0.2, o.radius * k, 200) };
              });
              setPovDeg(6);
              setDirty((x) => x + 1);
            }}
            title="표준 등각(=FOV 극소) 뷰로 스냅"
          >
            등각
          </button>
          <button className="btn" type="button" onClick={() => setPlaying((p) => !p)} title="자동 회전">
            {playing ? "정지" : "재생"}
          </button>
          <ObjectSelector primitives={demo.primitives as any} selectedId={selectedId} onChange={setSelectedId} />
          <StylePanel value={style} onChange={setStyle} />
          <button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(svg)} title="SVG 문자열 복사">
            SVG 복사
          </button>
        </div>
      </div>

      <div className="viewerBar">
        <div className="viewerHint">드래그: 회전 · 휠: 줌(거리) · POV: FOV · 클릭: 객체 선택</div>

        <label className="viewerLabel">
          POV
          <div className="viewerPovSlider">
            <Slider.Root
              className="radixSlider"
              min={4}
              max={85}
              step={1}
              value={[povDeg]}
              onValueChange={(v) => {
                const next = clamp(4, v[0] ?? povDeg, 85);
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
        className="svgWrap svgWrapInteractive svgStack"
        onPointerDown={(e) => {
          const el = wrapRef.current;
          if (!el) return;
          el.setPointerCapture(e.pointerId);
          setDrag({ x: e.clientX, y: e.clientY, az: orbit.azimuth, pol: orbit.polar, id: e.pointerId, moved: false });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          if (drag.id !== e.pointerId) return;
          const dx = e.clientX - drag.x;
          const dy = e.clientY - drag.y;
          const distSq = dx * dx + dy * dy;
          const moved = drag.moved || distSq > 9;

          const s = 0.0075;
          const az = drag.az + dx * s;
          const pol = clamp(0.05, drag.pol + dy * s, Math.PI - 0.05);
          setOrbit((o) => ({ ...o, azimuth: az, polar: pol }));
          setDirty((x) => x + 1);
          if (moved !== drag.moved) setDrag({ ...drag, moved });
        }}
        onPointerUp={(e) => {
          if (!drag) return;
          if (drag.id !== e.pointerId) return;
          // drag 이동이 거의 없으면 클릭으로 간주해서 객체 선택
          if (!drag.moved) {
            const id = pickAtClientPoint(e.clientX, e.clientY);
            setSelectedId(id);
          }
          setDrag(null);
        }}
        onWheel={(e) => {
          e.preventDefault();
          const k = Math.exp(e.deltaY * 0.0012);
          setOrbit((o) => ({ ...o, radius: clamp(0.2, o.radius * k, 200) }));
          setDirty((x) => x + 1);
        }}
      >
        <div className="svgLayer" dangerouslySetInnerHTML={{ __html: svg }} />
        {highlightSvg ? (
          <div className="svgLayer svgOverlay" dangerouslySetInnerHTML={{ __html: highlightSvg }} />
        ) : null}
      </div>
    </section>
  );
}
