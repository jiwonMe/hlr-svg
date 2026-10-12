import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Camera } from "@hlr/camera/camera.js";
import { sphereSilhouetteToCubics3 } from "@hlr/curves/builders.js";
import { Vec3 } from "@hlr/math/vec3.js";
import { PlaneRect } from "@hlr/scene/primitives/planeRect.js";
import { Sphere } from "@hlr/scene/primitives/sphere.js";
import {
  CIRCLED,
  ExamProvider,
  PenMark,
  Question,
  useExam,
} from "./exam/exam";
import {
  ExamFigure,
  HiddenLineProvider,
  type HiddenLineMode,
} from "./exam/ExamFigure";
import type { ExamFigureModel } from "./exam/figures";
import { LEAD_QUESTION, PAPER_QUESTIONS } from "./exam/questions";
import { CodeWindow, InstallCommand } from "./site/Code";
import { SiteFooter } from "./site/SiteFooter";
import { SiteHeader } from "./site/SiteHeader";
import "./site/site.css";
import "./landing.css";

const DOCS = "/docs/ko-kr";
const TOTAL_POINTS = PAPER_QUESTIONS.reduce((sum, q) => sum + q.points, 0);

const HIDDEN_MODES: readonly { mode: HiddenLineMode; label: string }[] = [
  { mode: "dashed", label: "점선" },
  { mode: "removed", label: "지우기" },
  { mode: "solid", label: "실선" },
];

const FEATURES = [
  {
    title: "숨은선 판정",
    body: "곡선 위의 점마다 카메라에서 광선을 보내, 가려진 구간을 찾아 점선으로 나눕니다.",
  },
  {
    title: "교선 계산",
    body: "구·원기둥·원뿔·평면이 서로 만나는 곡선을 구하고, 3차 베지어 곡선으로 맞춥니다.",
  },
  {
    title: "벡터 그대로",
    body: "결과는 경로만으로 된 SVG입니다. 확대해도 깨지지 않고 디자인 도구에서 바로 고칩니다.",
  },
  {
    title: "메시도 같은 방식",
    body: "OBJ·STL을 불러오면 삼각형 메시의 모서리도 같은 규칙으로 실선과 점선을 가립니다.",
  },
] as const;

const SNIPPET = `import {
  Camera, PlaneRect, Scene, Sphere, SvgRenderer, Vec3,
} from "hlr";

const scene = new Scene([
  new Sphere("S", new Vec3(0, 0, 0), 2),
  new PlaneRect("α", new Vec3(0, 0.8, 0), new Vec3(0, 1, 0),
    new Vec3(1, 0, 0), 3.2, 3.2),
]);

const camera = Camera.from({
  kind: "orthographic",
  position: new Vec3(6, 5, 7),
  target: new Vec3(0, 0, 0),
  up: new Vec3(0, 1, 0),
  halfHeight: 3.1,
  aspect: 4 / 3,
  near: 0.1,
  far: 100,
});

const svg = new SvgRenderer({ width: 480, height: 360 })
  .render(scene, camera);`;

// The output pane renders the snippet's own scene with the same defaults:
// sphere outline, plane border and the sphere–plane section.
function buildSnippetFigure(width: number, height: number): ExamFigureModel {
  const sphere = new Sphere("S", Vec3.zero(), 2);
  const plane = new PlaneRect(
    "α",
    new Vec3(0, 0.8, 0),
    new Vec3(0, 1, 0),
    new Vec3(1, 0, 0),
    3.2,
    3.2,
  );
  const camera = Camera.from({
    kind: "orthographic",
    position: new Vec3(6, 5, 7),
    target: Vec3.zero(),
    up: new Vec3(0, 1, 0),
    halfHeight: 3.1 * Math.max(1, (4 / 3) * (height / width)),
    aspect: width / height,
    near: 0.1,
    far: 100,
  });
  return {
    demo: {
      name: "Sphere and plane snippet",
      width,
      height,
      camera,
      primitives: [sphere, plane],
      includeIntersections: true,
      curves: ({ camera }) =>
        sphereSilhouetteToCubics3({
          cameraPos: camera.position,
          viewDirection:
            camera.kind === "orthographic" ? camera.forward : undefined,
          center: sphere.center,
          radius: sphere.radius,
        }),
    },
    annotate: () => "",
  };
}

export function LandingPage(): React.ReactElement {
  const [hidden, setHidden] = useState<HiddenLineMode>("dashed");
  const schoolYear = useMemo(() => new Date().getFullYear() + 1, []);
  return (
    <ExamProvider>
      <HiddenLineProvider value={hidden}>
        <div className="site landing">
          <a
            className="skip-link"
            href="#main"
            onClick={(event) => {
              event.preventDefault();
              document.getElementById("main")?.focus();
            }}
          >
            본문 바로가기
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="frame">
            <Hero schoolYear={schoolYear} />
            <Features />
            <Paper
              schoolYear={schoolYear}
              hidden={hidden}
              onHidden={setHidden}
            />
            <CodeBand />
            <Closing />
          </main>
          <SiteFooter />
        </div>
      </HiddenLineProvider>
    </ExamProvider>
  );
}

function Hero({ schoolYear }: { schoolYear: number }) {
  return (
    <section className="band hero" aria-labelledby="hero-title">
      <p className="hero-top">{schoolYear}학년도 HLR SVG 모의평가 문제지</p>
      <Link className="exam-pill" to={`${DOCS}/examples`}>
        <span className="exam-pill-period">제 2 교시</span>
        <span className="exam-pill-text">공간도형 그림 다섯 문항</span>
        <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
      </Link>
      <h1 id="hero-title" className="hero-title">
        보이는 선은 실선으로,{" "}
        <br />
        가려진 선은 점선으로.
      </h1>
      <p className="hero-sub">
        HLR SVG는 3차원 도형의 윤곽선과 교선을 계산하고, 가려진 구간을 찾아
        점선으로 나누는 TypeScript 라이브러리입니다. 수학 시험지 속 그림을
        코드로 그리세요.
      </p>
      <div className="hero-cta">
        <Link className="btn btn-primary btn-lg" to={`${DOCS}/quickstart`}>
          시작하기
          <ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} />
        </Link>
        <Link className="btn btn-secondary btn-lg" to={`${DOCS}/examples`}>
          예제 갤러리
        </Link>
        <InstallCommand className="hero-install" />
      </div>
      <figure className="hero-figure" id="lead-figure">
        <ExamFigure
          id={LEAD_QUESTION.figure.id}
          label={LEAD_QUESTION.figure.label}
          ratio={0.74}
          spin={0.14}
          eager
        />
      </figure>
    </section>
  );
}

function HiddenLineSwitch({
  value,
  onChange,
}: {
  value: HiddenLineMode;
  onChange: (mode: HiddenLineMode) => void;
}) {
  return (
    <div className="hidden-switch" role="group" aria-label="가려진 선 표시">
      <span className="seg-label">가려진 선</span>
      <div className="seg">
        {HIDDEN_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Features() {
  return (
    <section className="band features" aria-labelledby="features-title">
      <h2 id="features-title" className="sr-only">
        HLR SVG가 하는 일
      </h2>
      <ul className="feature-grid">
        {FEATURES.map((feature, index) => (
          <li key={feature.title}>
            <span className="feature-no" aria-hidden="true">
              {CIRCLED[index]}
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Paper({
  schoolYear,
  hidden,
  onHidden,
}: {
  schoolYear: number;
  hidden: HiddenLineMode;
  onHidden: (mode: HiddenLineMode) => void;
}) {
  const [left, right] = [PAPER_QUESTIONS.slice(0, 2), PAPER_QUESTIONS.slice(2)];
  return (
    <section className="band paper" aria-labelledby="paper-title">
      <div className="band-head">
        <div>
          <p className="band-eyebrow">5지선다형</p>
          <h2 id="paper-title" className="band-title">
            시험지 속 그림, 그대로.
          </h2>
          <p className="band-desc">
            좌표공간, 정육면체, 원기둥, 서로 접하는 구. 공간도형 문항에 나오는
            그림을 HLR SVG로 렌더링했습니다. 답을 고르면 바로 채점합니다.
          </p>
        </div>
        <Link className="btn btn-secondary" to={`${DOCS}/examples`}>
          예제 갤러리
          <ArrowRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </Link>
      </div>
      <div className="sheet">
        <p className="sheet-top">{schoolYear}학년도 HLR SVG 모의평가 문제지</p>
        <div className="sheet-title">
          <span className="sheet-period">제 2 교시</span>
          <h3 className="sheet-subject">
            수학 영역<small>(기하)</small>
          </h3>
          <span className="sheet-type">홀수형</span>
        </div>
        <div className="sheet-id" aria-hidden="true">
          <span className="sheet-field">
            성명
            <span className="sheet-name" />
          </span>
          <span className="sheet-field">
            수험 번호
            <span className="sheet-digits">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} />
              ))}
            </span>
            <span>–</span>
            <span className="sheet-digits">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} />
              ))}
            </span>
          </span>
        </div>
        <div className="sheet-notes">
          <ul>
            <li>그림을 끌면 시점이 바뀝니다.</li>
            <li>답을 고르면 바로 채점합니다.</li>
          </ul>
          <HiddenLineSwitch value={hidden} onChange={onHidden} />
        </div>
        <div className="sheet-cols">
          <div className="sheet-col">
            <p className="sheet-kind">5지선다형</p>
            {left.map((spec) => (
              <Question key={spec.no} spec={spec} linkLabel="크게 보기" />
            ))}
          </div>
          <div className="sheet-col">
            {right.map((spec) => (
              <Question key={spec.no} spec={spec} linkLabel="크게 보기" />
            ))}
            <div className="sheet-check">
              <p>※ 확인 사항</p>
              <p>
                ○ 그림 아래의 ‘SVG’를 누르면 지금 보이는 시점의 그림을 파일로
                저장할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
        <AnswerKey />
        <div className="sheet-foot">
          <span>
            이 문제지의 그림은 모두 HLR SVG로 렌더링했습니다. 실제 시험 문항이
            아닙니다.
          </span>
          <span className="sheet-page" aria-hidden="true">
            1
          </span>
        </div>
      </div>
    </section>
  );
}

function AnswerKey() {
  const { picks } = useExam();
  const answered = PAPER_QUESTIONS.filter((q) => picks[q.no] !== undefined);
  const score = answered
    .filter((q) => picks[q.no] === q.answer)
    .reduce((sum, q) => sum + q.points, 0);
  return (
    <details className="answer-key">
      <summary>
        <span>정답 확인</span>
        <span className="answer-score" role="status">
          {answered.length > 0 && (
            <>
              <strong>{score}</strong> / {TOTAL_POINTS}점
            </>
          )}
        </span>
      </summary>
      <table>
        <thead>
          <tr>
            <th scope="row">문항</th>
            {PAPER_QUESTIONS.map((q) => (
              <th key={q.no} scope="col">
                {q.no}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">정답</th>
            {PAPER_QUESTIONS.map((q) => (
              <td key={q.no}>{CIRCLED[q.answer - 1]}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">배점</th>
            {PAPER_QUESTIONS.map((q) => (
              <td key={q.no}>{q.points}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">내 답</th>
            {PAPER_QUESTIONS.map((q) => {
              const mine = picks[q.no];
              if (mine === undefined)
                return (
                  <td key={q.no} className="answer-none">
                    –
                  </td>
                );
              const correct = mine === q.answer;
              return (
                <td key={q.no}>
                  <span className="answer-mine">
                    {CIRCLED[mine - 1]}
                    <PenMark
                      key={`${mine}-${correct}`}
                      kind={correct ? "loop" : "slash"}
                      className="pen-grade"
                    />
                    <span className="sr-only">
                      {correct ? " 정답" : " 오답"}
                    </span>
                  </span>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </details>
  );
}

function CodeBand() {
  return (
    <section className="band code-band" aria-labelledby="code-title">
      <div className="code-copy">
        <p className="band-eyebrow">단답형</p>
        <h2 id="code-title" className="band-title">
          코드 몇 줄이면
          <br />
          그림이 나옵니다.
        </h2>
        <p className="band-desc">
          도형을 놓고 시점을 정한 뒤 렌더링하면 SVG 문자열이 나옵니다. 윤곽선과
          교선을 구하고 실선과 점선을 가르는 일은 렌더러가 맡습니다.
        </p>
        <ol className="steps">
          <li>
            <span className="steps-mark">(가)</span>
            <span>
              도형을 놓는다 <code>Scene</code> <code>Sphere</code>{" "}
              <code>PlaneRect</code>
            </span>
          </li>
          <li>
            <span className="steps-mark">(나)</span>
            <span>
              시점을 정한다 <code>Camera.from</code>
            </span>
          </li>
          <li>
            <span className="steps-mark">(다)</span>
            <span>
              그린다 <code>SvgRenderer.render</code>
            </span>
          </li>
        </ol>
        <Link className="text-link" to={`${DOCS}/quickstart`}>
          빠른 시작 문서
          <ArrowRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </Link>
      </div>
      <div className="code-demo">
        <CodeWindow title="sphere-and-plane.ts" code={SNIPPET} />
        <figure className="code-output">
          <figcaption>
            <span>출력</span>
            <span>구의 윤곽선 · 평면의 테두리 · 구와 평면의 교선</span>
          </figcaption>
          <ExamFigure
            id="sphere-and-plane"
            build={buildSnippetFigure}
            label="반지름이 2인 구와 구를 자르는 평면을 그린 SVG. 평면 아래로 가려진 구의 윤곽선과 교선의 뒤쪽 절반이 점선이다."
            ratio={0.75}
          />
        </figure>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="band closing" aria-labelledby="closing-title">
      <h2 id="closing-title" className="closing-title">
        이제 직접 그려 볼 차례입니다.
      </h2>
      <p className="closing-sub">
        브라우저의 도형 작업실에서 바로 그려 보거나, 프로젝트에 설치해
        시작하세요.
      </p>
      <div className="hero-cta">
        <Link className="btn btn-primary btn-lg" to="/playground">
          도형 작업실 열기
          <ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} />
        </Link>
        <Link className="btn btn-secondary btn-lg" to={`${DOCS}/quickstart`}>
          문서 읽기
        </Link>
      </div>
    </section>
  );
}
