import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { MDXProvider } from "@mdx-js/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  DEFAULT_LOCALE,
  getAllDocs,
  getDocBySlug,
  getNavGroups,
  type Locale,
} from "./mdxRegistry";
import { mdxComponents } from "./mdxComponents";
import { DocsToc } from "./DocsToc";

const TEXT = {
  "ko-kr": {
    period: (n: number) => `제 ${n} 교시`,
    groups: {
      "Getting Started": "시작하기",
      Examples: "예제",
      Reference: "레퍼런스",
    } as Record<string, string>,
    prev: "이전 문항",
    next: "다음 문항",
    foot: "이 문서의 그림과 예제는 HLR SVG로 렌더링했습니다.",
  },
  "en-us": {
    period: (n: number) => `Part ${n}`,
    groups: {} as Record<string, string>,
    prev: "Previous",
    next: "Next",
    foot: "Figures and examples in these docs are rendered with HLR SVG.",
  },
} as const;

/** An MDX page laid out like one page of an exam booklet. */
export function MdxDocPage(): React.ReactElement {
  const { locale, slug } = useParams<{ locale: string; slug: string }>();
  const lang: Locale =
    locale === "ko-kr" || locale === "en-us" ? locale : DEFAULT_LOCALE;
  const doc = slug ? getDocBySlug(lang, slug) : undefined;
  if (!doc) return <Navigate to={`/docs/${lang}/quickstart`} replace />;

  const t = TEXT[lang];
  const { Component, frontmatter } = doc;
  const groups = getNavGroups(lang);
  const period = groups.findIndex((g) => g.name === frontmatter.group) + 1;
  const docs = getAllDocs(lang);
  const index = docs.findIndex((d) => d.slug === doc.slug);
  const prev = docs[index - 1];
  const next = docs[index + 1];

  return (
    <div className="docs-page">
      <article className="docs-article">
        <header className="docs-head">
          <p className="exam-pill docs-pill">
            <span className="exam-pill-period">{t.period(period)}</span>
            <span>{t.groups[frontmatter.group] ?? frontmatter.group}</span>
          </p>
          <h1 className="docs-title">{frontmatter.title}</h1>
          {frontmatter.description && (
            <p className="docs-lede">{frontmatter.description}</p>
          )}
        </header>
        <div className="prose">
          <MDXProvider components={mdxComponents}>
            <Component />
          </MDXProvider>
        </div>
        <nav className="docs-pager" aria-label={`${t.prev} / ${t.next}`}>
          {prev ? (
            <Link to={`/docs/${lang}/${prev.slug}`} className="docs-pager-link">
              <span>
                <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.8} />
                {t.prev}
              </span>
              <strong>{prev.frontmatter.title}</strong>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              to={`/docs/${lang}/${next.slug}`}
              className="docs-pager-link is-next"
            >
              <span>
                {t.next}
                <ArrowRight aria-hidden="true" size={14} strokeWidth={1.8} />
              </span>
              <strong>{next.frontmatter.title}</strong>
            </Link>
          )}
        </nav>
        <p className="docs-foot">
          <span>{t.foot}</span>
          <span className="docs-foot-page" aria-hidden="true">
            {index + 1}
          </span>
        </p>
      </article>
      <DocsToc />
    </div>
  );
}
