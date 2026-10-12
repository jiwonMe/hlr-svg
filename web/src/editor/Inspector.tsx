import React from "react";
import {
  ArrowLeftRight,
  Copy,
  Eye,
  EyeOff,
  RotateCcw,
  Trash2,
  Unlink,
} from "lucide-react";
import type { BuiltScene } from "./build";
import { angleData } from "./build";
import { NumberField, Segmented, TextField, Toggle } from "./fields";
import { Glyph, KindIcon } from "./icons";
import { formatLength } from "./labels";
import { formatNumber, length3, sub3, type Tuple3 } from "./math";
import {
  consumedIds,
  freePoint,
  isPositioned,
  isRotated,
  KIND_NAMES,
  OPERATION_NAMES,
  type EditorDoc,
  type EditorObject,
  type PointConstraint,
  type RenderSettings,
} from "./model";
import { CONSTRAINT_NAMES } from "./resolve";
import type { EditorAction } from "./state";
import { ALL_TOOLS, toolAction, type ToolContext } from "./tools";

type Props = {
  doc: EditorDoc;
  scene: BuiltScene;
  selection: readonly string[];
  dispatch: React.Dispatch<EditorAction>;
  renderMs: number;
  ctx: ToolContext;
};

const AXES = ["X", "Y", "Z"] as const;

export function Inspector({
  doc,
  scene,
  selection,
  dispatch,
  renderMs,
  ctx,
}: Props) {
  const picked = selection
    .map((id) => doc.objects.find((o) => o.id === id))
    .filter((o): o is EditorObject => !!o);
  return (
    <div className="ed-inspector">
      {picked.length === 0 ? (
        <ScenePanel doc={doc} dispatch={dispatch} renderMs={renderMs} />
      ) : picked.length === 1 ? (
        <ObjectPanel
          key={picked[0]!.id}
          object={picked[0]!}
          doc={doc}
          scene={scene}
          dispatch={dispatch}
        />
      ) : (
        <MultiPanel objects={picked} dispatch={dispatch} ctx={ctx} />
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

const nameOf = (object: EditorObject | undefined, fallback = "?") =>
  object ? object.label || object.name : fallback;

function HeadActions({
  ids,
  hidden,
  dispatch,
}: {
  ids: string[];
  hidden: boolean;
  dispatch: React.Dispatch<EditorAction>;
}) {
  return (
    <div className="ed-object-actions">
      <button
        type="button"
        className="ed-icon-btn"
        onClick={() =>
          dispatch({
            type: "updateMany",
            patches: ids.map((id) => ({ id, patch: { hidden: !hidden } })),
          })
        }
        aria-pressed={hidden}
        title={hidden ? "보이기 (H)" : "숨기기 (H)"}
        aria-label={hidden ? "보이기" : "숨기기"}
      >
        {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <button
        type="button"
        className="ed-icon-btn"
        onClick={() => dispatch({ type: "duplicate", ids })}
        title="복제 (⌘D)"
        aria-label="복제"
      >
        <Copy size={15} />
      </button>
      <button
        type="button"
        className="ed-icon-btn"
        onClick={() => dispatch({ type: "remove", ids })}
        title="삭제 (Delete)"
        aria-label="삭제"
      >
        <Trash2 size={15} />
      </button>
    </div>
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
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  const note = scene.built.find((item) => item.objectId === object.id)?.note;
  const points = doc.objects.filter((o) => o.kind === "point");
  const consumed = consumedIds(doc.objects);
  const owner = doc.objects.find(
    (o) => o.kind === "boolean" && (o.a === object.id || o.b === object.id),
  );

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

  const pointSelect = (
    label: string,
    value: string,
    onChange: (id: string) => void,
  ) => (
    <PointSelect
      label={label}
      value={value}
      points={points}
      onChange={onChange}
    />
  );

  const title =
    object.kind === "boolean"
      ? `불리언 · ${OPERATION_NAMES[object.op]}`
      : object.kind === "point" && object.constraint
        ? `점 · ${CONSTRAINT_NAMES[object.constraint.type]}`
        : KIND_NAMES[object.kind];

  return (
    <>
      <div className="ed-object-head">
        <span className="ed-object-kind">
          <KindIcon kind={object.kind} size={20} />
          {title}
        </span>
        <HeadActions ids={[object.id]} hidden={object.hidden} dispatch={dispatch} />
      </div>

      {owner?.kind === "boolean" && (
        <p className="ed-note ed-note-quiet">
          <strong>{owner.name}</strong>의 {owner.a === object.id ? "A" : "B"}{" "}
          재료입니다. 결과에만 그려지고, 여기서 바꾸면 결과가 따라 바뀝니다.{" "}
          <button
            type="button"
            className="ed-link"
            onClick={() => dispatch({ type: "select", ids: [owner.id] })}
          >
            결과 고르기
          </button>
        </p>
      )}

      <Section title="이름">
        <div className="ed-text-fields">
          <TextField
            label="이름"
            value={object.name}
            onBegin={begin}
            onChange={(name) => update({ name }, true)}
          />
          <TextField
            label="라벨"
            value={object.label}
            placeholder={
              object.kind === "angle"
                ? "각도"
                : object.kind === "measure"
                  ? "길이"
                  : "없음"
            }
            onBegin={begin}
            onChange={(label) => update({ label }, true)}
          />
        </div>
        {object.labelOffset && (
          <div className="ed-row-actions">
            <button
              type="button"
              className="tool-btn"
              onClick={() => update({ labelOffset: undefined })}
            >
              <RotateCcw size={13} />
              라벨 자리 되돌리기
            </button>
          </div>
        )}
      </Section>

      {object.kind === "point" && object.constraint ? (
        <ConstraintSection
          point={object}
          constraint={object.constraint}
          byId={byId}
          position={scene.points.get(object.id) ?? object.position}
          update={update}
          begin={begin}
        />
      ) : (
        isPositioned(object) && (
          <Section title={object.kind === "point" ? "좌표" : "위치"}>
            {vectorFields("position", object.position, { step: 0.1 })}
          </Section>
        )
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
      {object.kind === "box" && (
        <Section title="크기">
          {vectorFields("size", object.size, { step: 0.1, min: 0.01 })}
        </Section>
      )}
      {(object.kind === "plane" ||
        object.kind === "disk" ||
        object.kind === "face") && (
        <Section title={object.kind === "face" ? "면" : "크기"}>
          {object.kind === "plane" && (
            <div className="ed-pair">
              {scalar("width", "가로")}
              {scalar("depth", "세로")}
            </div>
          )}
          {object.kind === "disk" && scalar("radius", "반지름")}
          <Toggle
            label="가림면"
            description={
              object.opaque
                ? "뒤에 있는 선을 점선으로 가립니다"
                : "투명: 테두리와 자른 자리만 그립니다"
            }
            checked={object.opaque}
            onChange={(opaque) => update({ opaque })}
          />
        </Section>
      )}

      {object.kind === "boolean" && (
        <Section title="불리언">
          <Segmented
            label="연산"
            value={object.op}
            options={[
              { value: "union", label: "합치기" },
              { value: "subtract", label: "빼기" },
              { value: "intersect", label: "교집합" },
            ]}
            onChange={(op) => update({ op })}
          />
          <ul className="ed-operands">
            {(["a", "b"] as const).map((side) => {
              const operand = byId.get(object[side]);
              return (
                <li key={side}>
                  <span className="ed-operand-side">{side.toUpperCase()}</span>
                  <button
                    type="button"
                    className="ed-link"
                    onClick={() =>
                      dispatch({ type: "select", ids: [object[side]] })
                    }
                  >
                    {operand && <KindIcon kind={operand.kind} size={15} />}
                    {nameOf(operand)}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="ed-hint">
            {object.op === "subtract"
              ? "A에서 B와 겹치는 부분을 덜어 냅니다."
              : object.op === "union"
                ? "A와 B를 한 덩어리로 합칩니다."
                : "A와 B가 겹치는 부분만 남깁니다."}{" "}
            재료를 고르면 옮기고 크기를 바꿀 수 있습니다.
          </p>
          <div className="ed-row-actions">
            <button
              type="button"
              className="tool-btn"
              onClick={() => update({ a: object.b, b: object.a })}
            >
              <ArrowLeftRight size={13} />
              A·B 바꾸기
            </button>
            <button
              type="button"
              className="tool-btn"
              disabled={consumed.has(object.id)}
              onClick={() => dispatch({ type: "dissolve", id: object.id })}
              title="불리언을 풀고 두 재료를 그대로 둡니다"
            >
              <Unlink size={13} />
              풀기
            </button>
          </div>
        </Section>
      )}

      {object.kind === "segment" && (
        <Section title="선분">
          <div className="ed-pair">
            {pointSelect("시작", object.from, (from) => update({ from }))}
            {pointSelect("끝", object.to, (to) => update({ to }))}
          </div>
          <div className="ed-field-row">
            <span>선</span>
            <Segmented
              label="선 모양"
              value={object.line}
              options={[
                { value: "auto", label: "자동", title: "가려지면 점선" },
                { value: "dashed", label: "점선", title: "늘 점선 (보조선)" },
                { value: "solid", label: "실선", title: "늘 실선" },
              ]}
              onChange={(line) => update({ line })}
            />
          </div>
          <Toggle
            label="화살표"
            description="끝점에 화살촉을 그립니다"
            checked={object.arrow}
            onChange={(arrow) => update({ arrow })}
          />
          <MeasuredLength
            a={scene.points.get(object.from)}
            b={scene.points.get(object.to)}
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

      {object.kind === "angle" && (
        <Section title="각">
          <div className="ed-face-points">
            {pointSelect("A", object.from, (from) => update({ from }))}
            {pointSelect("꼭짓점", object.vertex, (vertex) =>
              update({ vertex }),
            )}
            {pointSelect("B", object.to, (to) => update({ to }))}
          </div>
          <AngleValue object={object} scene={scene} byId={byId} />
          <div className="ed-field-row">
            <span>표시</span>
            <Segmented
              label="각 표시"
              value={object.mark}
              options={[
                { value: "auto", label: "자동", title: "90°면 직각 표시" },
                { value: "arc", label: "호" },
                { value: "right", label: "직각" },
              ]}
              onChange={(mark) => update({ mark })}
            />
          </div>
          <Toggle
            label="각도 쓰기"
            description="라벨이 비어 있으면 잰 값을 씁니다"
            checked={object.showValue}
            onChange={(showValue) => update({ showValue })}
          />
          <NumberField
            label="호 반지름"
            value={object.radius}
            step={0.05}
            min={0.05}
            onBegin={begin}
            onChange={(radius, transient) => update({ radius }, transient)}
          />
        </Section>
      )}

      {object.kind === "measure" && (
        <Section title="길이">
          <div className="ed-pair">
            {pointSelect("시작", object.from, (from) => update({ from }))}
            {pointSelect("끝", object.to, (to) => update({ to }))}
          </div>
          <MeasuredLength
            a={scene.points.get(object.from)}
            b={scene.points.get(object.to)}
            onUse={(text) => update({ label: text })}
          />
          <p className="ed-hint">
            라벨에 <code>√6/2</code>처럼 쓰면 분수와 근호로 그립니다.
          </p>
        </Section>
      )}

      {note && <p className="ed-note">{note}</p>}
    </>
  );
}

function MeasuredLength({
  a,
  b,
  onUse,
}: {
  a: Tuple3 | undefined;
  b: Tuple3 | undefined;
  onUse?: (text: string) => void;
}) {
  if (!a || !b) return null;
  const value = length3(sub3(b, a));
  const exact = formatLength(value);
  return (
    <div className="ed-readout">
      <span>잰 길이</span>
      <strong>{exact}</strong>
      {exact !== formatNumber(value, 4) && (
        <small>≈ {formatNumber(value, 4)}</small>
      )}
      {onUse && (
        <button type="button" className="ed-link" onClick={() => onUse(exact)}>
          라벨로
        </button>
      )}
    </div>
  );
}

function AngleValue({
  object,
  scene,
  byId,
}: {
  object: Extract<EditorObject, { kind: "angle" }>;
  scene: BuiltScene;
  byId: Map<string, EditorObject>;
}) {
  const data = angleData(object, scene.points);
  const name = `∠${nameOf(byId.get(object.from))}${nameOf(byId.get(object.vertex))}${nameOf(byId.get(object.to))}`;
  return (
    <div className="ed-readout">
      <span>{name}</span>
      <strong>{data ? `${formatNumber(data.degrees, 2)}°` : "—"}</strong>
    </div>
  );
}

function ConstraintSection({
  point,
  constraint: c,
  byId,
  position,
  update,
  begin,
}: {
  point: Extract<EditorObject, { kind: "point" }>;
  constraint: PointConstraint;
  byId: Map<string, EditorObject>;
  position: Tuple3;
  update: (patch: Partial<EditorObject>, transient?: boolean) => void;
  begin: () => void;
}) {
  const of = (id: string) => nameOf(byId.get(id));
  const from =
    c.type === "midpoint"
      ? `${of(c.a)}, ${of(c.b)}`
      : c.type === "foot"
        ? `${of(c.point)} → ${of(c.onto)}`
        : c.type === "intersection"
          ? `${of(c.line)} ∩ ${of(c.surface)}`
          : c.type === "onSegment"
            ? of(c.segment)
            : c.type === "onSphere"
              ? of(c.sphere)
              : c.type === "onPlane"
                ? of(c.plane)
                : of(c.of);
  const field = (
    label: string,
    value: number,
    patch: (v: number) => PointConstraint,
    options: { step: number; min?: number; max?: number; unit?: string },
  ) => (
    <NumberField
      label={label}
      value={value}
      step={options.step}
      min={options.min}
      max={options.max}
      unit={options.unit}
      onBegin={begin}
      onChange={(v, transient) => update({ constraint: patch(v) }, transient)}
    />
  );
  return (
    <Section title="작도">
      <div className="ed-readout">
        <span>{CONSTRAINT_NAMES[c.type]}</span>
        <strong>{from}</strong>
      </div>
      {c.type === "onSegment" &&
        field("비율", c.t, (t) => ({ ...c, t }), { step: 0.05, min: 0, max: 1 })}
      {c.type === "onSphere" && (
        <div className="ed-pair">
          {field("방위", c.azimuth, (azimuth) => ({ ...c, azimuth }), {
            step: 1,
            unit: "°",
          })}
          {field("고도", c.elevation, (elevation) => ({ ...c, elevation }), {
            step: 1,
            min: -90,
            max: 90,
            unit: "°",
          })}
        </div>
      )}
      {c.type === "onPlane" && (
        <div className="ed-pair">
          {field("u", c.u, (u) => ({ ...c, u }), { step: 0.1 })}
          {field("v", c.v, (v) => ({ ...c, v }), { step: 0.1 })}
        </div>
      )}
      <div className="ed-readout">
        <span>좌표</span>
        <strong className="ed-mono">
          ({position.map((v) => formatNumber(v, 3)).join(", ")})
        </strong>
      </div>
      <p className="ed-hint">
        {c.type === "onSegment" || c.type === "onSphere" || c.type === "onPlane"
          ? "화면에서 끌면 규칙을 지킨 채 움직입니다."
          : "기준 도형을 옮기면 따라 움직입니다."}
      </p>
      <div className="ed-row-actions">
        <button
          type="button"
          className="tool-btn"
          onClick={() => {
            const free = freePoint(point, position);
            update({ constraint: undefined, position: free.position });
          }}
        >
          <Unlink size={13} />
          자유 점으로 풀기
        </button>
      </div>
    </Section>
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

function MultiPanel({
  objects,
  dispatch,
  ctx,
}: {
  objects: EditorObject[];
  dispatch: React.Dispatch<EditorAction>;
  ctx: ToolContext;
}) {
  const ids = objects.map((o) => o.id);
  const available = ALL_TOOLS.map((tool) => ({
    tool,
    action: toolAction(tool.id, ctx),
  })).filter(
    ({ tool, action }) =>
      action &&
      // Segments and faces from nothing are not about this selection.
      (tool.id !== "segment" || objects.every((o) => o.kind === "point")) &&
      (tool.id !== "face" ||
        (objects.length >= 3 && objects.every((o) => o.kind === "point"))),
  );
  return (
    <>
      <div className="ed-object-head">
        <span className="ed-object-kind">{objects.length}개 고름</span>
        <HeadActions
          ids={ids}
          hidden={objects.every((o) => o.hidden)}
          dispatch={dispatch}
        />
      </div>
      <Section title="고른 순서">
        <ol className="ed-chips">
          {objects.map((object, index) => (
            <li key={object.id}>
              <button
                type="button"
                onClick={() => dispatch({ type: "select", ids: [object.id] })}
                title="이것만 고르기"
              >
                <span className="ed-chip-index">{index + 1}</span>
                <KindIcon kind={object.kind} size={14} />
                {nameOf(object)}
              </button>
            </li>
          ))}
        </ol>
        <p className="ed-hint">
          이동·회전·크기(W·E·R) 도구로 함께 바꿉니다. 불리언과 각은 고른 순서를
          따릅니다.
        </p>
      </Section>
      {available.length > 0 && (
        <Section title="이 선택으로">
          <div className="ed-action-list">
            {available.map(({ tool, action }) => (
              <button
                key={tool.id}
                type="button"
                className="tool-btn"
                onClick={() => action && dispatch(action)}
                title={tool.needs}
              >
                <Glyph name={tool.id} size={15} />
                {tool.label}
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
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
  const consumed = consumedIds(doc.objects);
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
          description="도형끼리, 투명한 면이 자르는 곡선"
          checked={settings.intersections}
          onChange={(intersections) => set({ intersections })}
        />
      </Section>
      <Section title="표시">
        <Toggle
          label="라벨"
          description="점과 도형의 이름, 각과 길이"
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
            <dd>{doc.objects.length - consumed.size}</dd>
          </div>
          <div>
            <dt>렌더</dt>
            <dd>{renderMs.toFixed(0)} ms</dd>
          </div>
        </dl>
      </Section>
      <Section title="도움말">
        <ul className="ed-help">
          <li>
            <kbd>Shift</kbd>+누르기로 여럿 고르기, 같은 자리를 다시 누르면 뒤의
            도형
          </li>
          <li>
            빼기: 구 → 원기둥 순서로 고르고 <strong>빼기</strong>
          </li>
          <li>
            중점·수선의 발·교점은 기준을 옮기면 따라 움직입니다
          </li>
          <li>
            라벨은 끌어서 옮기고, <code>√6/2</code>처럼 쓰면 수식으로 그립니다
          </li>
        </ul>
      </Section>
    </>
  );
}
