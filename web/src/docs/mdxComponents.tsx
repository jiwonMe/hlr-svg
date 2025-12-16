import React from "react";
import type { ComponentType, ReactNode, AnchorHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type MdxComponentProps = {
  children?: ReactNode;
  className?: string;
};

/**
 * MDX 컴포넌트 스타일 매핑
 * MDXProvider에 전달하여 MDX 콘텐츠의 기본 요소들을 스타일링
 */
export const mdxComponents: Record<string, ComponentType<MdxComponentProps>> = {
  // 헤딩
  h1: ({ children, className }) => (
    <h1
      className={cn(
        // 타이포그래피
        "text-3xl font-bold tracking-tight",
        // 마진
        "mt-8 mb-4 first:mt-0",
        // 색상
        "text-foreground",
        className
      )}
    >
      {children}
    </h1>
  ),

  h2: ({ children, className }) => (
    <h2
      className={cn(
        // 타이포그래피
        "text-2xl font-semibold tracking-tight",
        // 마진
        "mt-8 mb-4",
        // 색상
        "text-foreground",
        // 보더
        "border-b border-border pb-2",
        className
      )}
    >
      {children}
    </h2>
  ),

  h3: ({ children, className }) => (
    <h3
      className={cn(
        // 타이포그래피
        "text-xl font-semibold",
        // 마진
        "mt-6 mb-3",
        // 색상
        "text-foreground",
        className
      )}
    >
      {children}
    </h3>
  ),

  h4: ({ children, className }) => (
    <h4
      className={cn(
        // 타이포그래피
        "text-lg font-semibold",
        // 마진
        "mt-4 mb-2",
        // 색상
        "text-foreground",
        className
      )}
    >
      {children}
    </h4>
  ),

  // 텍스트
  p: ({ children, className }) => (
    <p
      className={cn(
        // 타이포그래피
        "text-base leading-7",
        // 마진
        "my-4",
        // 색상
        "text-foreground",
        className
      )}
    >
      {children}
    </p>
  ),

  // 링크
  a: ({
    children,
    className,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className={cn(
        // 색상
        "text-primary",
        // 언더라인
        "underline underline-offset-4",
        // 호버
        "hover:text-primary/80",
        // 트랜지션
        "transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </a>
  ),

  // 리스트
  ul: ({ children, className }) => (
    <ul
      className={cn(
        // 리스트 스타일
        "list-disc list-outside",
        // 마진/패딩
        "my-4 ml-6",
        // 간격
        "space-y-2",
        className
      )}
    >
      {children}
    </ul>
  ),

  ol: ({ children, className }) => (
    <ol
      className={cn(
        // 리스트 스타일
        "list-decimal list-outside",
        // 마진/패딩
        "my-4 ml-6",
        // 간격
        "space-y-2",
        className
      )}
    >
      {children}
    </ol>
  ),

  li: ({ children, className }) => (
    <li
      className={cn(
        // 타이포그래피
        "text-base leading-7",
        // 색상
        "text-foreground",
        className
      )}
    >
      {children}
    </li>
  ),

  // 코드
  code: ({ children, className }) => {
    // 인라인 코드 (pre 내부가 아닌 경우)
    return (
      <code
        className={cn(
          // 배경
          "bg-muted",
          // 패딩
          "px-1.5 py-0.5",
          // 라운드
          "rounded-md",
          // 타이포그래피
          "text-sm",
          // 색상
          "text-foreground",
          className
        )}
      >
        {children}
      </code>
    );
  },

  pre: ({ children, className }) => (
    <pre
      className={cn(
        // 배경
        "bg-muted",
        // 패딩
        "p-4",
        // 라운드
        "rounded-lg",
        // 마진
        "my-4",
        // 오버플로우
        "overflow-x-auto",
        // 타이포그래피
        "text-sm",
        className
      )}
    >
      {children}
    </pre>
  ),

  // 인용
  blockquote: ({ children, className }) => (
    <blockquote
      className={cn(
        // 보더
        "border-l-4 border-primary",
        // 패딩
        "pl-4 py-2",
        // 마진
        "my-4",
        // 배경
        "bg-muted/50",
        // 라운드
        "rounded-r-md",
        // 이탤릭
        "italic",
        // 색상
        "text-muted-foreground",
        className
      )}
    >
      {children}
    </blockquote>
  ),

  // 수평선
  hr: ({ className }) => (
    <hr className={cn("my-8", "border-border", className)} />
  ),

  // 테이블
  table: ({ children, className }) => (
    <div className={cn("my-4", "overflow-x-auto")}>
      <table
        className={cn(
          // 너비
          "w-full",
          // 보더
          "border-collapse border border-border",
          // 타이포그래피
          "text-sm",
          className
        )}
      >
        {children}
      </table>
    </div>
  ),

  th: ({ children, className }) => (
    <th
      className={cn(
        // 패딩
        "px-4 py-2",
        // 보더
        "border border-border",
        // 배경
        "bg-muted",
        // 텍스트
        "text-left font-semibold",
        className
      )}
    >
      {children}
    </th>
  ),

  td: ({ children, className }) => (
    <td
      className={cn(
        // 패딩
        "px-4 py-2",
        // 보더
        "border border-border",
        className
      )}
    >
      {children}
    </td>
  ),

  // 강조
  strong: ({ children, className }) => (
    <strong className={cn("font-semibold", className)}>{children}</strong>
  ),

  em: ({ children, className }) => (
    <em className={cn("italic", className)}>{children}</em>
  ),
};
