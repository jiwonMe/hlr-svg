import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { ExamFigure } from "./ExamFigure";
import type { FigureId } from "./figures";
import "./exam.css";

/* ── Math typesetting: just enough for exam stems and choices ─────────── */

export function V({ children }: { children: React.ReactNode }) {
  return <var className="m-v">{children}</var>;
}

export function Sqrt({ children }: { children: React.ReactNode }) {
  return (
    <span className="m-sqrt">
      <span className="m-rad">{children}</span>
    </span>
  );
}

/** `say` is what a screen reader hears, e.g. "3분의 루트 3". */
export function Frac({
  n,
  d,
  say,
}: {
  n: React.ReactNode;
  d: React.ReactNode;
  say?: string;
}) {
  return (
    <span className="m-frac-wrap">
      <span className="m-frac" aria-hidden={say ? true : undefined}>
        <span className="m-num">{n}</span>
        <span className="m-den">{d}</span>
      </span>
      {say && <span className="sr-only">{say}</span>}
    </span>
  );
}

export function Vec({ children }: { children: React.ReactNode }) {
  return <span className="m-vec">{children}</span>;
}

/* ── Answers shared between the paper, the clipping and the answer key ─── */

export type Choice = 1 | 2 | 3 | 4 | 5;
type Picks = Partial<Record<number, Choice>>;

const ExamContext = createContext<{
  picks: Picks;
  pick: (question: number, choice: Choice) => void;
}>({ picks: {}, pick: () => {} });

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const [picks, setPicks] = useState<Picks>({});
  const pick = useCallback(
    (question: number, choice: Choice) =>
      setPicks((current) => ({ ...current, [question]: choice })),
    [],
  );
  const value = useMemo(() => ({ picks, pick }), [picks, pick]);
  return <ExamContext.Provider value={value}>{children}</ExamContext.Provider>;
}

export function useExam() {
  return useContext(ExamContext);
}

export const CIRCLED = ["①", "②", "③", "④", "⑤"] as const;

/* ── Pen marks ──────────────────────────────────────────────────────────── */

// A loose, overshooting loop like a quick pen circle.
const LOOP =
  "M 63 9 C 32 1 5 20 8 51 C 11 83 50 99 79 84 C 99 73 98 31 73 14 C 63 8 49 7 37 12";
const SLASH = "M 18 90 C 38 62 60 37 88 8";

export function PenMark({
  kind,
  className = "",
}: {
  kind: "loop" | "slash";
  className?: string;
}) {
  return (
    <svg
      className={`pen ${className}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={kind === "loop" ? LOOP : SLASH} pathLength={1} />
    </svg>
  );
}

/* ── Question ───────────────────────────────────────────────────────────── */

export type QuestionSpec = {
  no: number;
  points: 3 | 4;
  answer: Choice;
  stem: React.ReactNode;
  conditions?: React.ReactNode;
  closing?: React.ReactNode;
  figure: { id: FigureId; label: string; ratio: number; width: number };
  /** What the figure demonstrates about the renderer. */
  caption: React.ReactNode;
  /** The gallery page that shows this figure at full size. */
  exampleId: string;
  choices: readonly React.ReactNode[];
  /** Spoken forms of the choices. */
  choiceText: readonly string[];
  solution: React.ReactNode;
  drawing: React.ReactNode;
};

export function Question({
  spec,
  eager = false,
  showFigure = true,
  linkLabel,
}: {
  spec: QuestionSpec;
  eager?: boolean;
  /** Layouts that place the figure beside the stem render it themselves. */
  showFigure?: boolean;
  /** Adds a link to the example page under the figure. */
  linkLabel?: string;
}): React.ReactElement {
  const { picks, pick } = useExam();
  const name = useId();
  const selected = picks[spec.no];
  const graded =
    selected === undefined
      ? undefined
      : selected === spec.answer
        ? "correct"
        : "wrong";
  return (
    <article className="q" aria-label={`${spec.no}번 문항`}>
      <p className="q-stem">
        <span className="q-no">
          {spec.no}.
          {graded && (
            <PenMark
              key={`${graded}-${selected}`}
              kind={graded === "correct" ? "loop" : "slash"}
              className="pen-grade"
            />
          )}
        </span>{" "}
        {spec.stem}
        {!spec.conditions && <Points value={spec.points} />}
      </p>
      {spec.conditions && (
        <>
          <div className="q-cond">{spec.conditions}</div>
          <p className="q-stem q-closing">
            {spec.closing}
            <Points value={spec.points} />
          </p>
        </>
      )}
      {showFigure && (
        <QuestionFigure spec={spec} eager={eager} linkLabel={linkLabel} />
      )}
      <fieldset className="q-choices">
        <legend className="sr-only">{spec.no}번 답 고르기</legend>
        {spec.choices.map((choice, index) => {
          const value = (index + 1) as Choice;
          return (
            <label key={value} className="q-choice">
              <input
                className="sr-only"
                type="radio"
                name={name}
                value={value}
                checked={selected === value}
                onChange={() => pick(spec.no, value)}
              />
              <span className="q-choice-no" aria-hidden="true">
                {CIRCLED[index]}
                {selected === value && (
                  <PenMark kind="loop" className="pen-pick" />
                )}
              </span>
              <span className="q-choice-value" aria-hidden="true">
                {choice}
              </span>
              <span className="sr-only">
                {value}번, {spec.choiceText[index]}
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="sr-only" aria-live="polite">
        {graded === "correct"
          ? `${spec.no}번 정답입니다.`
          : graded === "wrong"
            ? `${spec.no}번 오답입니다. 다시 골라 보세요.`
            : ""}
      </p>
    </article>
  );
}

export function QuestionFigure({
  spec,
  eager = false,
  linkLabel,
  className = "",
}: {
  spec: QuestionSpec;
  eager?: boolean;
  linkLabel?: string;
  className?: string;
}): React.ReactElement {
  return (
    <figure
      className={`q-fig ${className}`}
      style={{ maxWidth: spec.figure.width }}
    >
      <ExamFigure
        id={spec.figure.id}
        label={spec.figure.label}
        ratio={spec.figure.ratio}
        eager={eager}
      />
      <figcaption className="q-fig-caption">
        <span>{spec.caption}</span>
        {linkLabel && (
          <Link to={`/docs/ko-kr/examples/${spec.exampleId}`}>
            {linkLabel}
            <ArrowUpRight aria-hidden="true" size={13} strokeWidth={1.8} />
          </Link>
        )}
      </figcaption>
    </figure>
  );
}

function Points({ value }: { value: number }) {
  return <span className="q-pts"> [{value}점]</span>;
}
