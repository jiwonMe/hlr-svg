import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { ExamFigure } from "../../exam/ExamFigure";
import { EXAMPLES } from "./examplesRegistry";
import { THUMBNAIL_BUILDERS } from "./exampleFigures";
import { exampleLabel } from "./DocsExamplePage";
import "./examples.css";

type Locale = "ko-kr" | "en-us";

const TEXT = {
  "ko-kr": {
    pill: "제 2 교시",
    pillText: "예제",
    title: "예제 갤러리",
    lede: "수능 공간도형 문항의 그림과 기본 예제를 HLR SVG로 렌더링했습니다. 카드를 누르면 그림을 돌려 보고, 문항을 풀고, 코드를 볼 수 있습니다.",
    exam: "수능형 공간도형",
    examNote: "모의평가 24–28번 문항의 그림",
    basic: "기본 예제",
    basicNote: "도형, 교선, 메시 불러오기",
    open: "열기",
  },
  "en-us": {
    pill: "Part 2",
    pillText: "Examples",
    title: "Example gallery",
    lede: "Figures from Korean CSAT-style solid geometry questions, plus the basics, all rendered with HLR SVG. Open a card to rotate the figure, solve the question and read the code.",
    exam: "Exam figures",
    examNote: "Figures from mock questions 24–28",
    basic: "Basics",
    basicNote: "Primitives, intersections, mesh import",
    open: "Open",
  },
} as const;

export function DocsExamplesIndexPage(): React.ReactElement {
  const { locale } = useParams<{ locale?: string }>();
  const lang: Locale =
    locale === "ko-kr" || locale === "en-us" ? locale : "en-us";
  const t = TEXT[lang];
  const groups = [
    { key: "exam", title: t.exam, note: t.examNote },
    { key: "basic", title: t.basic, note: t.basicNote },
  ] as const;

  return (
    <div className="gallery">
      <header className="gallery-head">
        <p className="exam-pill">
          <span className="exam-pill-period">{t.pill}</span>
          <span>{t.pillText}</span>
        </p>
        <h1 className="docs-title">{t.title}</h1>
        <p className="docs-lede">{t.lede}</p>
      </header>
      {groups.map((group) => {
        const items = EXAMPLES.filter((ex) => ex.kind === group.key);
        return (
          <section
            key={group.key}
            className="gallery-section"
            aria-labelledby={`gallery-${group.key}`}
          >
            <div className="gallery-section-head">
              <h2 id={`gallery-${group.key}`}>
                {group.title}
                <span className="gallery-count">{items.length}</span>
              </h2>
              <p>{group.note}</p>
            </div>
            <ul className="gallery-grid">
              {items.map((ex) => {
                const info = ex.text[lang];
                return (
                  <li key={ex.id} className="gallery-card">
                    <Link
                      to={`/docs/${lang}/examples/${ex.id}`}
                      className="gallery-link"
                    >
                      <div className="gallery-thumb">
                        <ExamFigure
                          id={ex.id}
                          build={THUMBNAIL_BUILDERS[ex.id]}
                          label={info.title}
                          ratio={0.72}
                          interactive={false}
                        />
                      </div>
                      <div className="gallery-meta">
                        <p className="gallery-no">
                          {exampleLabel(ex.id, lang)}
                        </p>
                        <h3>{info.title}</h3>
                        <p className="gallery-desc">{info.description}</p>
                        <ul className="gallery-tags">
                          {info.tags.map((tag) => (
                            <li key={tag}>{tag}</li>
                          ))}
                        </ul>
                      </div>
                      <span className="gallery-open" aria-hidden="true">
                        {t.open}
                        <ArrowUpRight size={14} strokeWidth={1.8} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
