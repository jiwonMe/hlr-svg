import React from "react";
import { useParams, Navigate } from "react-router-dom";
import { MDXProvider } from "@mdx-js/react";
import { getDocBySlug } from "./mdxRegistry";
import { mdxComponents } from "./mdxComponents";
import { cn } from "../lib/utils";

/**
 * MDX 문서 페이지 컴포넌트
 * URL의 :slug 파라미터로 해당 MDX 문서를 렌더링
 */
export function MdxDocPage(): React.ReactElement {
  const { slug } = useParams<{ slug: string }>();
  const doc = slug ? getDocBySlug(slug) : undefined;

  // 문서를 찾지 못한 경우 quickstart로 리다이렉트
  if (!doc) {
    return <Navigate to="/docs/quickstart" replace />;
  }

  const { Component, frontmatter } = doc;

  return (
    <article
      className={cn(
        // 최대 너비 및 가운데 정렬
        "max-w-4xl mx-auto",
        // 패딩
        "px-6 py-8",
        // 타이포그래피 기본
        "text-foreground"
      )}
    >
      {/* 문서 헤더 */}
      <header className={cn("mb-8", "border-b border-border", "pb-6")}>
        <h1
          className={cn(
            // 타이포그래피
            "text-3xl font-bold tracking-tight",
            // 색상
            "text-foreground",
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
              "text-lg",
              // 색상
              "text-muted-foreground"
            )}
          >
            {frontmatter.description}
          </p>
        )}
      </header>

      {/* MDX 콘텐츠 */}
      <MDXProvider components={mdxComponents}>
        <div
          className={cn(
            // prose 스타일 대체 (직접 구현)
            "space-y-4"
          )}
        >
          <Component />
        </div>
      </MDXProvider>
    </article>
  );
}
