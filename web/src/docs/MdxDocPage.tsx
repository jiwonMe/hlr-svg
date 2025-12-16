import React from "react";
import { useParams, Navigate } from "react-router-dom";
import { MDXProvider } from "@mdx-js/react";
import { getDocBySlug, DEFAULT_LOCALE, type Locale } from "./mdxRegistry";
import { mdxComponents } from "./mdxComponents";
import { DocsToc } from "./DocsToc";
import { cn } from "../lib/utils";

/**
 * MDX 문서 페이지 컴포넌트
 * flex 디자인 시스템 스타일 적용
 */
export function MdxDocPage(): React.ReactElement {
  const { locale, slug } = useParams<{
    locale: string;
    slug: string;
  }>();

  // locale이 유효한지 확인하고 기본값 설정
  const validLocale: Locale =
    locale === "ko-kr" || locale === "en-us" ? locale : DEFAULT_LOCALE;

  const doc = slug ? getDocBySlug(validLocale, slug) : undefined;

  if (!doc) {
    return (
      <Navigate to={`/docs/${validLocale}/quickstart`} replace />
    );
  }

  const { Component, frontmatter } = doc;

  return (
    <div className={cn("flex w-full")}>
      {/* 문서 콘텐츠 */}
      <article
        className={cn(
          // 최대 너비
          "max-w-3xl",
          // 가운데 정렬
          "mx-auto",
          // 패딩
          "px-8 py-10",
          // 플렉스
          "flex-1"
        )}
      >
        {/* 문서 헤더 */}
        <header className={cn("mb-8")}>
          <h1
            className={cn(
              // 타이포그래피
              "text-2xl font-semibold tracking-tight",
              // 색상
              "text-[hsl(220,9%,18%)]",
              // 마진
              "mb-2"
            )}
          >
            {frontmatter.title}
          </h1>
          {frontmatter.description && (
            <p
              className={cn(
                // 타이포그래피
                "text-base",
                // 색상
                "text-[hsl(220,9%,46%)]"
              )}
            >
              {frontmatter.description}
            </p>
          )}
        </header>

        {/* MDX 콘텐츠 */}
        <MDXProvider components={mdxComponents}>
          <div>
            <Component />
          </div>
        </MDXProvider>
      </article>

      {/* TOC (우측) */}
      <DocsToc />
    </div>
  );
}
