import React from "react";
import { Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import type { BuiltScene } from "./build";
import { NumberField, Segmented, Toggle } from "./fields";
import { KindIcon } from "./icons";
import type { Tuple3 } from "./math";
import {
  isPositioned,
  isRotated,
  KIND_NAMES,
  type EditorDoc,
  type EditorObject,
  type RenderSettings,
} from "./model";
import type { EditorAction } from "./state";

type Props = {
  doc: EditorDoc;
  scene: BuiltScene;
  selection: string | null;
  dispatch: React.Dispatch<EditorAction>;
  renderMs: number;
};

const AXES = ["X", "Y", "Z"] as const;

export function Inspector({
  doc,
  scene,
  selection,
  dispatch,
  renderMs,
}: Props) {
  const object = doc.objects.find((o) => o.id === selection);
  return (
    <div className="ed-inspector">
      {object ? (
        <ObjectPanel
          key={object.id}
          object={object}
          doc={doc}
          scene={scene}
          dispatch={dispatch}
        />
      ) : (
        <ScenePanel doc={doc} dispatch={dispatch} renderMs={renderMs} />
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ed-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ObjectPanel({
  object,
  doc,
  scene,
  dispatch,
}: {
  object: EditorObject;
  doc: EditorDoc;
  scene: BuiltScene;
  dispatch: React.Dispatch<EditorAction>;
}) {
  const update = (patch: Partial<EditorObject>, transient = false) =>
    dispatch({ type: "update", id: object.id, patch, transient });
  const begin = () => dispatch({ type: "checkpoint" });
  const note = scene.built.find((item) => item.objectId === object.id)?.note;
  const points = doc.objects.filter((o) => o.kind === "point");

  const vectorFields = (
    key: "position" | "rotation" | "size",
    value: Tuple3,
    options: { step: number; unit?: string; min?: number; digits?: number },
  ) => (
    <div className="ed-vector">
      {AXES.map((axis, i) => (
        <NumberField
          key={axis}
          label={axis}
          value={value[i]!}
          step={options.step}
          min={options.min}
          unit={options.unit}
          digits={options.digits}
          onBegin={begin}
          onChange={(v, transient) => {
            const next = [...value] as [number, number, number];
            next[i] = v;
            update({ [key]: next } as Partial<EditorObject>, transient);
          }}
        />
      ))}
    </div>
  );

  const scalar = (
    key: "radius" | "height" | "width" | "depth",
    label: string,
  ) => (
    <NumberField
      label={label}
      value={(object as unknown as Record<string, number>)[key]!}
      step={0.1}
      min={0.01}
      onBegin={begin}
      onChange={(v, transient) =>
        update({ [key]: v } as Partial<EditorObject>, transient)
      }
    />
  );

  return (
    <>
      <div className="ed-object-head">
        <span className="ed-object-kind">
          <KindIcon kind={object.kind} size={20} />
          {KIND_NAMES[object.kind]}
        </span>
        <div className="ed-object-actions">
          <button
            type="button"
            className="ed-icon-btn"
            onClick={() => update({ hidden: !object.hidden })}
            aria-pressed={object.hidden}
            title={object.hidden ? "보이기" : "숨기기"}
            aria-label={object.hidden ? "보이기" : "숨기기"}
          >
            {object.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button
            type="button"
            className="ed-icon-btn"
            onClick={() => dispatch({ type: "duplicate", id: object.id })}
            title="복제 (⌘D)"
            aria-label="복제"
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            className="ed-icon-btn"
            onClick={() => dispatch({ type: "remove", id: object.id })}
            title="삭제 (Delete)"
            aria-label="삭제"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <Section title="이름">
        <div className="ed-text-fields">
          <label className="ed-text">
            <span>이름</span>
            <input
              value={object.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </label>
          <label className="ed-text">
            <span>라벨</span>
            <input
              value={object.label}
              placeholder="없음"
              onChange={(event) => update({ label: event.target.value })}
            />
          </label>
        </div>
      </Section>

      {isPositioned(object) && (
        <Section title={object.kind === "point" ? "좌표" : "위치"}>
          {vectorFields("position", object.position, { step: 0.1 })}
        </Section>
      )}

      {isRotated(object) && (
        <Section title="회전">
          {vectorFields("rotation", object.rotation, {
            step: 1,
            unit: "°",
            digits: 2,
          })}
        </Section>
      )}

      {object.kind === "sphere" && (
        <Section title="크기">{scalar("radius", "반지름")}</Section>
      )}
      {(object.kind === "cylinder" || object.kind === "cone") && (
        <Section title="크기">
          <div className="ed-pair">
            {scalar("radius", "반지름")}
            {scalar("height", "높이")}
          </div>
        </Section>
      )}
      {object.kind === "disk" && (
        <Section title="크기">{scalar("radius", "반지름")}</Section>
      )}
      {object.kind === "plane" && (
        <Section title="크기">
          <div className="ed-pair">
            {scalar("width", "가로")}
            {scalar("depth", "세로")}
          </div>
        </Section>
      )}
      {object.kind === "box" && (
        <Section title="크기">
          {vectorFields("size", object.size, { step: 0.1, min: 0.01 })}
        </Section>
      )}

      {object.kind === "segment" && (
        <Section title="양 끝">
          <div className="ed-pair">
            <PointSelect
              label="시작"
              value={object.from}
              points={points}
              onChange={(from) => update({ from })}
            />
            <PointSelect
              label="끝"
              value={object.to}
              points={points}
              onChange={(to) => update({ to })}
            />
          </div>
          <Toggle
            label="화살표"
            description="끝점에 화살촉을 그립니다"
            checked={object.arrow}
            onChange={(arrow) => update({ arrow })}
          />
        </Section>
      )}

      {object.kind === "face" && (
        <Section title="꼭짓점">
          <div className="ed-face-points">
            {object.points.map((pointId, index) => (
              <PointSelect
                key={index}
                label={`${index + 1}`}
                value={pointId}
                points={points}
                onChange={(id) => {
                  const next = [...object.points];
                  next[index] = id;
                  update({ points: next });
                }}
              />
            ))}
          </div>
          <div className="ed-row-actions">
            <button
              type="button"
              className="tool-btn"
              disabled={points.length <= object.points.length}
              onClick={() => {
                const unused = points.find(
                  (p) => !object.points.includes(p.id),
                );
                if (unused) update({ points: [...object.points, unused.id] });
              }}
            >
              꼭짓점 추가
            </button>
            <button
              type="button"
              className="tool-btn"
              disabled={object.points.length <= 3}
              onClick={() => update({ points: object.points.slice(0, -1) })}
            >
              마지막 빼기
            </button>
          </div>
        </Section>
      )}

      {note && <p className="ed-note">{note}</p>}
    </>
  );
}

function PointSelect({
  label,
  value,
  points,
  onChange,
}: {
  label: string;
  value: string;
  points: readonly EditorObject[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="ed-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {points.map((point) => (
          <option key={point.id} value={point.id}>
            {point.label || point.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScenePanel({
  doc,
  dispatch,
  renderMs,
}: {
  doc: EditorDoc;
  dispatch: React.Dispatch<EditorAction>;
  renderMs: number;
}) {
  const { settings } = doc;
  const set = (patch: Partial<RenderSettings>, transient = false) =>
    dispatch({ type: "settings", patch, transient });
  const begin = () => dispatch({ type: "checkpoint" });
  return (
    <>
      <div className="ed-object-head">
        <span className="ed-object-kind">장면 설정</span>
      </div>
      <Section title="선">
        <div className="ed-field-row">
          <span>가려진 선</span>
          <Segmented
            label="가려진 선"
            value={settings.hiddenLines}
            options={[
              { value: "dashed", label: "점선" },
              { value: "removed", label: "지우기" },
              { value: "solid", label: "실선" },
            ]}
            onChange={(hiddenLines) => set({ hiddenLines })}
          />
        </div>
        <NumberField
          label="굵기"
          value={settings.strokeWidth}
          step={0.05}
          min={0.5}
          max={4}
          onBegin={begin}
          onChange={(strokeWidth, transient) => set({ strokeWidth }, transient)}
        />
        <Toggle
          label="교선"
          description="도형끼리 만나는 곡선"
          checked={settings.intersections}
          onChange={(intersections) => set({ intersections })}
        />
      </Section>
      <Section title="표시">
        <Toggle
          label="라벨"
          description="점과 도형의 이름"
          checked={settings.labels}
          onChange={(labels) => set({ labels })}
        />
        <Toggle
          label="점 표시"
          description="점마다 작은 원"
          checked={settings.pointDots}
          onChange={(pointDots) => set({ pointDots })}
        />
        <Toggle
          label="바닥 격자"
          description="작업용 안내선, 저장되지 않음"
          checked={settings.grid}
          onChange={(grid) => set({ grid })}
        />
      </Section>
      <Section title="면 채색">
        <Toggle
          label="조명으로 채색"
          description="저장하는 SVG에도 들어갑니다"
          checked={settings.shading}
          onChange={(shading) => set({ shading })}
        />
        {settings.shading && (
          <>
            <NumberField
              label="방위각"
              value={settings.lightAzimuth}
              step={1}
              min={-180}
              max={360}
              unit="°"
              onBegin={begin}
              onChange={(lightAzimuth, transient) =>
                set({ lightAzimuth }, transient)
              }
            />
            <NumberField
              label="높이"
              value={settings.lightElevation}
              step={1}
              min={-85}
              max={85}
              unit="°"
              onBegin={begin}
              onChange={(lightElevation, transient) =>
                set({ lightElevation }, transient)
              }
            />
            <NumberField
              label="주변광"
              value={settings.ambient}
              step={0.02}
              min={0}
              max={1}
              onBegin={begin}
              onChange={(ambient, transient) => set({ ambient }, transient)}
            />
          </>
        )}
      </Section>
      <Section title="통계">
        <dl className="ed-stats">
          <div>
            <dt>개체</dt>
            <dd>{doc.objects.length}</dd>
          </div>
          <div>
            <dt>렌더</dt>
            <dd>{renderMs.toFixed(0)} ms</dd>
          </div>
        </dl>
      </Section>
    </>
  );
}
