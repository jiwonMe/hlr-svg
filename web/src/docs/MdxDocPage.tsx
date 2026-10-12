import React, { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { MDXProvider } from "@mdx-js/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Copy } from "lucide-react";
import { GROUP_TITLES } from "./locale";
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
    copyMarkdown: "Markdown 복사",
    copied: "복사했습니다",
    copyFailed: "복사하지 못했습니다",
    openMarkdown: "이 문서를 Markdown으로 열기 (LLM용)",
    prev: "이전 문항",
    next: "다음 문항",
    foot: "이 문서의 그림과 예제는 HLR SVG로 렌더링했습니다.",
  },
  "en-us": {
    period: (n: number) => `Part ${n}`,
    copyMarkdown: "Copy Markdown",
    copied: "Copied",
    copyFailed: "Copy failed",
    openMarkdown: "Open this page as Markdown (for LLMs)",
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
          <div className="docs-head-top">
            <p className="exam-pill docs-pill">
              <span className="exam-pill-period">{t.period(period)}</span>
              <span>
                {GROUP_TITLES[lang][frontmatter.group] ?? frontmatter.group}
              </span>
            </p>
            <MarkdownTools lang={lang} slug={doc.slug} />
          </div>
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

/** The page as Markdown, for pasting into an AI assistant (see docs/llms). */
function MarkdownTools({ lang, slug }: { lang: Locale; slug: string }) {
  const t = TEXT[lang];
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const url = `${import.meta.env.BASE_URL}docs/${lang}/${slug}.md`;

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    try {
      const text = fetch(url).then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      });
      // Safari only allows clipboard writes started inside the click itself.
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write)
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": text.then((s) => new Blob([s], { type: "text/plain" })),
          }),
        ]);
      else await navigator.clipboard.writeText(await text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="docs-md-tools">
      <button type="button" className="tool-btn" onClick={() => void copy()}>
        {status === "copied" ? <Check size={13} /> : <Copy size={13} />}
        {status === "copied"
          ? t.copied
          : status === "failed"
            ? t.copyFailed
            : t.copyMarkdown}
      </button>
      <a
        className="tool-btn"
        href={url}
        target="_blank"
        rel="noreferrer"
        title={t.openMarkdown}
        aria-label={t.openMarkdown}
      >
        .md
        <ArrowUpRight aria-hidden="true" size={13} strokeWidth={1.8} />
      </a>
    </div>
  );
}
