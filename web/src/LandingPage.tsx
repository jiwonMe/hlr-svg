import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  MoveUpRight,
} from "lucide-react";
import { EditorialDiagram } from "./components/EditorialDiagram";
import "./landing.css";

const DOCS = "/docs/ko-kr";

export function LandingPage(): React.ReactElement {
  const examplesRef = useRef<HTMLElement>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  function showExamples() {
    examplesRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    examplesRef.current?.focus({ preventScroll: true });
  }

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText("pnpm add hlr");
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="geometry-paper">
      <a
        className="paper-skip-link"
        href="#paper-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("paper-main")?.focus();
        }}
      >
        본문으로 건너뛰기
      </a>
      <div className="paper-sheet">
        <header className="paper-header">
          <div className="paper-edition">
            <span>THE GEOMETRY PRESS</span>
            <span>선을 위한 수학, 수학을 위한 선</span>
            <span>VOL. 01 &nbsp; / &nbsp; OPEN SOURCE</span>
          </div>
          <div className="paper-masthead">
            <div className="masthead-note">
              <span className="masthead-cross" aria-hidden="true">
                ✳
              </span>
              <span>
                공간의 깊이를
                <br />
                평면의 언어로.
              </span>
            </div>
            <Link className="paper-wordmark" to="/" aria-label="HLR SVG 홈">
              HLR<span className="wordmark-divider">/</span>SVG
            </Link>
            <div className="masthead-note masthead-note-right">
              <span>HIDDEN LINE REMOVAL</span>
              <span>3D GEOMETRY → 2D VECTOR</span>
            </div>
          </div>
          <nav className="paper-nav" aria-label="주 메뉴">
            <div className="paper-nav-links">
              <Link to="/" aria-current="page">
                소개
              </Link>
              <button type="button" onClick={showExamples}>
                예제 도형
              </button>
              <Link to={`${DOCS}/quickstart`}>사용 안내</Link>
              <a
                href="https://github.com/jiwonMe/hlr-svg"
                target="_blank"
                rel="noreferrer"
              >
                GitHub <ArrowUpRight aria-hidden="true" size={13} />
              </a>
            </div>
            <Link className="nav-workspace" to="/playground">
              도형 작업실 <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </nav>
        </header>
        <main id="paper-main" tabIndex={-1}>
          <section className="paper-lead" aria-labelledby="lead-title">
            <div className="lead-story">
              <div className="paper-eyebrow">
                <span className="edition-dot" /> 공간도형을 그리는 새로운 방법
              </div>
              <h1 id="lead-title">
                공간을 읽고,
                <br />
                선을 남기다.
              </h1>
              <p className="lead-deck">
                복잡한 입체도, 한 장의 명료한 그림으로.
              </p>
              <p className="lead-description">
                보이는 선은 실선으로, 가려진 선은 점선으로.
                <br className="desktop-break" />
                HLR SVG는 입체의 깊이와 관계를 읽어
                <br className="desktop-break" />
                수학 교재 속 도형처럼 정교한 SVG를 만듭니다.
              </p>
              <div className="lead-actions">
                <Link className="paper-button" to="/playground">
                  직접 그려보기 <ArrowUpRight aria-hidden="true" size={17} />
                </Link>
                <Link className="paper-text-link" to={`${DOCS}/quickstart`}>
                  시작하는 방법 <span aria-hidden="true">→</span>
                </Link>
              </div>
              <div className="lead-footnote">
                <span className="footnote-mark">*</span>
                <p>
                  공간도형과 공간벡터, 교재와 시험지,
                  <br />
                  그리고 선으로 설명하는 모든 장면을 위해.
                </p>
              </div>
              <button
                type="button"
                className="lead-scroll"
                onClick={showExamples}
              >
                아래에서 도형 살펴보기{" "}
                <ArrowDown aria-hidden="true" size={14} />
              </button>
            </div>
            <div className="lead-examination">
              <div className="exam-heading">
                <span>제 1 교시</span>
                <h2>기하 영역</h2>
                <span className="exam-subject">공간도형과 공간벡터</span>
              </div>
              <div className="exam-question">
                <p>
                  <strong className="question-number">01.</strong> 반지름이 2인
                  구와 45°의 각을 이루는 두 평면 α, β가 있다. 두 단면 위의 점과
                  선분이 이루는 공간을 살펴보자.
                </p>
                <span className="question-score">[ 예시 도형 ]</span>
              </div>
              <EditorialDiagram kind="sphere-sections" interactive />
              <div className="exam-caption">
                <span>그림 1. 구와 두 평면의 단면</span>
                <Link to={`${DOCS}/examples/sphere-plane-sections`}>
                  예제 자세히 보기 <ArrowUpRight aria-hidden="true" size={13} />
                </Link>
              </div>
            </div>
          </section>
          <div className="paper-principles" aria-label="렌더링 특징">
            <div>
              <span className="line-sample" aria-hidden="true" />
              <span>보이는 선은 또렷하게</span>
            </div>
            <div>
              <span
                className="line-sample line-sample-dashed"
                aria-hidden="true"
              />
              <span>가려진 선은 섬세하게</span>
            </div>
            <div>
              <span className="vector-sample" aria-hidden="true">
                ↗
              </span>
              <span>확대해도 선명한 벡터로</span>
            </div>
          </div>
          <section
            className="paper-examples"
            ref={examplesRef}
            tabIndex={-1}
            aria-labelledby="examples-title"
          >
            <div className="section-heading">
              <div>
                <p className="paper-eyebrow">
                  도형 연구 &nbsp; / &nbsp; SELECTED EXAMPLES
                </p>
                <h2 id="examples-title">한 선 한 선, 공간의 해석.</h2>
              </div>
              <Link className="paper-text-link" to={`${DOCS}/examples`}>
                모든 예제 보기 <ArrowUpRight aria-hidden="true" size={15} />
              </Link>
            </div>
            <div className="example-spread">
              <article className="example-problem">
                <div className="example-title-row">
                  <span className="example-number">02</span>
                  <div>
                    <span className="example-category">
                      공간도형 · 구의 위치 관계
                    </span>
                    <h3>서로 접하는 구, 이어지는 관계.</h3>
                  </div>
                  <span className="example-points">[ 구와 평면 ]</span>
                </div>
                <p className="example-description">
                  하나의 큰 구에 접하는 세 개의 작은 구. 평면 위에 놓인 구들의
                  접점과 교선을 따라, 입체의 앞뒤 관계를 읽습니다.
                </p>
                <Link
                  className="example-figure-link"
                  to={`${DOCS}/examples/tangent-spheres`}
                  aria-label="구에 접하는 세 구 예제 열기"
                >
                  <EditorialDiagram kind="tangent-spheres" />
                  <span className="figure-open">
                    <MoveUpRight size={17} aria-hidden="true" />
                  </span>
                </Link>
                <div className="example-endnote">
                  <span>그림 2. 구에 접하는 세 구</span>
                  <Link to={`${DOCS}/examples/tangent-spheres`}>
                    도형 탐구하기 <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </article>
              <article className="example-problem">
                <div className="example-title-row">
                  <span className="example-number">03</span>
                  <div>
                    <span className="example-category">
                      이차곡선 · 평면과 입체의 교선
                    </span>
                    <h3>평면으로 자르면, 곡선이 된다.</h3>
                  </div>
                  <span className="example-points">[ 원뿔의 단면 ]</span>
                </div>
                <p className="example-description">
                  원뿔을 비스듬히 지나는 하나의 평면. 두 도형이 만나는 경계를
                  계산하고, 곡선의 보이는 부분과 숨은 부분을 구분합니다.
                </p>
                <Link
                  className="example-figure-link"
                  to={`${DOCS}/examples/conic-section`}
                  aria-label="원뿔과 평면의 단면 예제 열기"
                >
                  <EditorialDiagram kind="conic-section" />
                  <span className="figure-open">
                    <MoveUpRight size={17} aria-hidden="true" />
                  </span>
                </Link>
                <div className="example-endnote">
                  <span>그림 3. 원뿔과 평면의 교선</span>
                  <Link to={`${DOCS}/examples/conic-section`}>
                    도형 탐구하기 <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </article>
            </div>
            <p className="examples-editor-note">
              ※ 이 페이지의 그림은 HLR SVG로 렌더링한 예제입니다. 실제
              수능·모의고사 기출 문항이 아닙니다.
            </p>
          </section>
          <section className="paper-colophon" aria-labelledby="start-title">
            <div className="colophon-heading">
              <p className="paper-eyebrow">
                다음 페이지 &nbsp; / &nbsp; GET STARTED
              </p>
              <h2 id="start-title">이제, 당신의 도형을 그릴 차례.</h2>
            </div>
            <div className="colophon-body">
              <p>
                브라우저에서 바로 도형을 다루거나,
                <br />
                TypeScript 프로젝트에 HLR을 더해 보세요.
              </p>
              <div className="install-area">
                <button
                  className="install-command"
                  type="button"
                  onClick={copyInstall}
                  aria-label="설치 명령어 pnpm add hlr 복사"
                >
                  <span aria-hidden="true">$</span>
                  <code>pnpm add hlr</code>
                  {copyStatus === "copied" ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                </button>
                <span className="install-status" role="status">
                  {copyStatus === "copied"
                    ? "설치 명령어를 복사했습니다."
                    : copyStatus === "failed"
                      ? "복사하지 못했습니다. pnpm add hlr을 직접 입력해 주세요."
                      : ""}
                </span>
              </div>
            </div>
            <Link className="colophon-link" to={`${DOCS}/quickstart`}>
              문서에서 시작하기 <ArrowUpRight aria-hidden="true" size={23} />
            </Link>
          </section>
        </main>
        <footer className="paper-footer">
          <Link to="/" className="footer-wordmark">
            HLR / SVG
          </Link>
          <span>수학의 깊이, 선의 명료함.</span>
          <div>
            <a
              href="https://github.com/jiwonMe/hlr-svg/blob/main/LICENSE"
              target="_blank"
              rel="noreferrer"
            >
              MIT LICENSE
            </a>
            <a
              href="https://www.npmjs.com/package/hlr"
              target="_blank"
              rel="noreferrer"
            >
              NPM ↗
            </a>
          </div>
        </footer>
        <div className="paper-page-number" aria-hidden="true">
          <span>1</span>
        </div>
      </div>
    </div>
  );
}
