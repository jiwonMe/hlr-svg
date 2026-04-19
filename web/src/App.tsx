import React, { useCallback, useMemo, useState } from "react";

import { Camera } from "@hlr/camera/camera.js";
import {
  coneSilhouetteToCubics3,
  cylinderSilhouetteToCubics3,
  sphereSilhouetteToCubics3,
} from "@hlr/curves/builders.js";
import { buildDemoCases } from "@hlr/demo/cases.js";
import type { DemoCase } from "@hlr/demo/types.js";
import { Vec3 } from "@hlr/math/vec3.js";
import { Cone } from "@hlr/scene/primitives/cone.js";
import { Cylinder } from "@hlr/scene/primitives/cylinder.js";
import { Sphere } from "@hlr/scene/primitives/sphere.js";

import { Viewer } from "./Viewer";

type Mode = "single" | "all";

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomVec3(min: number, max: number): Vec3 {
  return new Vec3(
    randomFloat(min, max),
    randomFloat(min, max),
    randomFloat(min, max),
  );
}

function randomUnitVec3(): Vec3 {
  const x = randomFloat(-1, 1);
  const y = randomFloat(-1, 1);
  const z = randomFloat(-1, 1);
  return Vec3.normalize(new Vec3(x, y, z));
}

function createRandomDemoCase(_seed: number): DemoCase {
  // seed를 사용해 재현 가능한 랜덤 생성 (간단하게 Math.random 사용)
  const width = 700;
  const height = 520;

  const cam = Camera.from({
    kind: "perspective",
    position: new Vec3(3.2, 2.2, 4.5),
    target: new Vec3(0, 0, 0),
    up: new Vec3(0, 1, 0),
    fovYRad: (55 * Math.PI) / 180,
    aspect: width / height,
    near: 0.1,
    far: 100,
  });

  // 도형 타입 선택 (Sphere, Cylinder, Cone)
  const types = ["sphere", "cylinder", "cone"] as const;
  const type1 = types[Math.floor(Math.random() * types.length)]!;
  const type2 = types[Math.floor(Math.random() * types.length)]!;

  const pos1 = randomVec3(-1.5, 1.5);
  const pos2 = randomVec3(-1.5, 1.5);

  let prim1: Sphere | Cylinder | Cone;
  let prim2: Sphere | Cylinder | Cone;

  if (type1 === "sphere") {
    prim1 = new Sphere("random1", pos1, randomFloat(0.4, 1.0));
  } else if (type1 === "cylinder") {
    const axis = randomUnitVec3();
    prim1 = new Cylinder(
      "random1",
      pos1,
      axis,
      randomFloat(1.0, 2.5),
      randomFloat(0.3, 0.8),
      "both",
    );
  } else {
    const axis = randomUnitVec3();
    prim1 = new Cone(
      "random1",
      pos1,
      axis,
      randomFloat(1.0, 2.5),
      randomFloat(0.4, 1.0),
      "base",
    );
  }

  if (type2 === "sphere") {
    prim2 = new Sphere("random2", pos2, randomFloat(0.4, 1.0));
  } else if (type2 === "cylinder") {
    const axis = randomUnitVec3();
    prim2 = new Cylinder(
      "random2",
      pos2,
      axis,
      randomFloat(1.0, 2.5),
      randomFloat(0.3, 0.8),
      "both",
    );
  } else {
    const axis = randomUnitVec3();
    prim2 = new Cone(
      "random2",
      pos2,
      axis,
      randomFloat(1.0, 2.5),
      randomFloat(0.4, 1.0),
      "base",
    );
  }

  return {
    name: `랜덤: ${type1} × ${type2}`,
    width,
    height,
    camera: cam,
    primitives: [prim1, prim2],
    includeIntersections: true,
    curves: ({ camera }) => {
      const curves: ReturnType<typeof sphereSilhouetteToCubics3> = [];
      if (prim1 instanceof Sphere) {
        curves.push(
          ...sphereSilhouetteToCubics3({
            cameraPos: camera.position,
            center: prim1.center,
            radius: prim1.radius,
          }),
        );
      } else if (prim1 instanceof Cylinder) {
        curves.push(
          ...cylinderSilhouetteToCubics3({
            cameraPos: camera.position,
            base: prim1.base,
            axis: prim1.axis,
            height: prim1.height,
            radius: prim1.radius,
          }),
        );
      } else if (prim1 instanceof Cone) {
        curves.push(
          ...coneSilhouetteToCubics3({
            cameraPos: camera.position,
            apex: prim1.apex,
            axis: prim1.axis,
            height: prim1.height,
            baseRadius: prim1.baseRadius,
          }),
        );
      }
      if (prim2 instanceof Sphere) {
        curves.push(
          ...sphereSilhouetteToCubics3({
            cameraPos: camera.position,
            center: prim2.center,
            radius: prim2.radius,
          }),
        );
      } else if (prim2 instanceof Cylinder) {
        curves.push(
          ...cylinderSilhouetteToCubics3({
            cameraPos: camera.position,
            base: prim2.base,
            axis: prim2.axis,
            height: prim2.height,
            radius: prim2.radius,
          }),
        );
      } else if (prim2 instanceof Cone) {
        curves.push(
          ...coneSilhouetteToCubics3({
            cameraPos: camera.position,
            apex: prim2.apex,
            axis: prim2.axis,
            height: prim2.height,
            baseRadius: prim2.baseRadius,
          }),
        );
      }
      return curves.flat();
    },
  };
}

export function App(): React.ReactElement {
  const cases = useMemo(() => buildDemoCases(), []);
  const [mode, setMode] = useState<Mode>("single");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState(cases[0]?.name ?? "");
  const [randomCase, setRandomCase] = useState<DemoCase | null>(null);
  const [randomKey, setRandomKey] = useState(0);

  const generateRandom = useCallback(() => {
    const newCase = createRandomDemoCase(Date.now());
    setRandomCase(newCase);
    setRandomKey((k) => k + 1);
    setSelectedName(newCase.name);
    setMode("single");
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) => c.name.toLowerCase().includes(q));
  }, [cases, query]);

  const selected = useMemo(() => {
    if (randomCase && selectedName === randomCase.name) {
      return randomCase;
    }
    return cases.find((c) => c.name === selectedName) ?? cases[0] ?? null;
  }, [cases, selectedName, randomCase]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">HLR SVG Demo</div>
          <div className="brandSub">React + Vite</div>
        </div>

        <div className="controls">
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="케이스 검색…"
            aria-label="케이스 검색"
          />

          <button
            className="btn"
            type="button"
            onClick={generateRandom}
            title="랜덤 도형 2개 생성"
          >
            🎲 랜덤
          </button>

          <div className="segmented" role="tablist" aria-label="보기 모드">
            <button
              className={mode === "single" ? "segBtn segBtnActive" : "segBtn"}
              onClick={() => setMode("single")}
              type="button"
              role="tab"
              aria-selected={mode === "single"}
            >
              하나 보기
            </button>
            <button
              className={mode === "all" ? "segBtn segBtnActive" : "segBtn"}
              onClick={() => setMode("all")}
              type="button"
              role="tab"
              aria-selected={mode === "all"}
            >
              전체 보기
            </button>
          </div>
        </div>
      </header>

      <div className="content">
        <aside className="sidebar">
          <div className="sidebarTitle">Cases ({filtered.length})</div>
          <div
            className="caseList"
            role="listbox"
            aria-label="데모 케이스 목록"
          >
            {filtered.map((c) => {
              const active = c.name === selectedName;
              return (
                <button
                  key={c.name}
                  className={active ? "caseBtn caseBtnActive" : "caseBtn"}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setSelectedName(c.name);
                    setMode("single");
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="main">
          {mode === "single" ? (
            selected ? (
              <Viewer key={randomKey} demo={selected} />
            ) : (
              <div className="empty">케이스가 없습니다.</div>
            )
          ) : (
            <div className="grid">
              {filtered.map((c) => (
                <Viewer key={c.name} demo={c} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
