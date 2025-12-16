import React from "react";
import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ComponentType,
  ReactNode,
} from "react";
import { cn } from "../lib/utils";

type MdxComponentProps = {
  children?: ReactNode;
  className?: string;
};

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & MdxComponentProps;
type CodeProps = HTMLAttributes<HTMLElement> & MdxComponentProps;

/**
 * MDX 컴포넌트 스타일 매핑
 * flex 디자인 시스템 스타일 적용
 */
export const mdxComponents: Record<string, ComponentType<any>> = {
  // 헤딩
  h1: ({ children, className, ...props }: HeadingProps) => (
    <h1
      {...props}
      className={cn(
        // 타이포그래피
        "text-2xl font-semibold tracking-tight",
        // 마진
        "mt-8 mb-4 first:mt-0",
        // 색상
        "text-[hsl(220,9%,18%)]",
        className
      )}
    >
      {children}
    </h1>
  ),

  h2: ({ children, className, ...props }: HeadingProps) => (
    <h2
      {...props}
      className={cn(
        // 타이포그래피
        "text-xl font-semibold tracking-tight",
        // 마진
        "mt-10 mb-4",
        // 색상
        "text-[hsl(220,9%,18%)]",
        // 보더
        "border-b border-[hsl(220,13%,91%)] pb-3",
        className
      )}
    >
      {children}
    </h2>
  ),

  h3: ({ children, className, ...props }: HeadingProps) => (
    <h3
      {...props}
      className={cn(
        // 타이포그래피
        "text-lg font-semibold",
        // 마진
        "mt-8 mb-3",
        // 색상
        "text-[hsl(220,9%,18%)]",
        className
      )}
    >
      {children}
    </h3>
  ),

  h4: ({ children, className, ...props }: HeadingProps) => (
    <h4
      {...props}
      className={cn(
        // 타이포그래피
        "text-base font-semibold",
        // 마진
        "mt-6 mb-2",
        // 색상
        "text-[hsl(220,9%,18%)]",
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
        "text-[15px] leading-7",
        // 마진
        "my-4",
        // 색상
        "text-[hsl(220,9%,35%)]",
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
        "text-[hsl(152,69%,35%)]",
        // 호버
        "hover:text-[hsl(152,69%,25%)]",
        // 언더라인
        "hover:underline underline-offset-4",
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
        "text-[15px] leading-7",
        // 색상
        "text-[hsl(220,9%,35%)]",
        className
      )}
    >
      {children}
    </li>
  ),

  // 코드
  code: ({ children, className, ...props }: CodeProps) => {
    const dataLanguage = (props as Record<string, unknown>)["data-language"];
    const dataTheme = (props as Record<string, unknown>)["data-theme"];
    const isCodeFence =
      // fenced code는 보통 language-* 클래스가 붙음
      (typeof className === "string" && /(^|\s)language-/.test(className)) ||
      // rehype-pretty-code는 data-language / data-theme 같은 속성을 붙여줌
      typeof dataLanguage === "string" ||
      typeof dataTheme === "string";

    // 블록 코드(코드펜스)는 스타일을 pre에만 두고 code에는 붙이지 않음
    if (isCodeFence) {
      return (
        <code {...props} className={cn(className)}>
          {children}
        </code>
      );
    }

    // 인라인 코드는 기존 스타일 유지
    return (
      <code
        {...props}
        className={cn(
          // 배경
          "bg-[hsl(220,14%,96%)]",
          // 패딩
          "px-1.5 py-0.5",
          // 라운드
          "rounded",
          // 타이포그래피
          "text-[14px]",
          // 색상
          "text-[hsl(220,9%,30%)]",
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
        // 배경 (GitHub Dark)
        "bg-[#0d1117]",
        // 패딩
        "p-4",
        // 라운드
        "rounded-lg",
        // 오버플로우
        "overflow-x-auto",
        // 타이포그래피
        "text-[14px] leading-6",
        // 기본 텍스트 (토큰 컬러는 shiki inline style이 덮어씀)
        "text-[#c9d1d9]",
        className
      )}
    >
      {children}
    </pre>
  ),

  // rehype-pretty-code가 코드 블록을 figure로 감쌉니다 (기본 figure 마진 제거 + 간격 통일)
  figure: ({ children, className, ...props }: HTMLAttributes<HTMLElement>) => (
    <figure
      {...props}
      className={cn(
        // 마진
        "my-5",
        className
      )}
    >
      {children}
    </figure>
  ),

  // 인용
  blockquote: ({ children, className }) => (
    <blockquote
      className={cn(
        // 보더
        "border-l-4 border-[hsl(152,69%,41%)]",
        // 패딩
        "pl-4 py-1",
        // 마진
        "my-5",
        // 색상
        "text-[hsl(220,9%,46%)]",
        className
      )}
    >
      {children}
    </blockquote>
  ),

  // 수평선
  hr: ({ className }) => (
    <hr className={cn("my-8", "border-[hsl(220,13%,91%)]", className)} />
  ),

  // 테이블
  table: ({ children, className }) => (
    <div className={cn("my-5", "overflow-x-auto")}>
      <table
        className={cn(
          // 너비
          "w-full",
          // 타이포그래피
          "text-[14px]",
          className
        )}
      >
        {children}
      </table>
    </div>
  ),

  thead: ({ children, className }) => (
    <thead
      className={cn(
        // 보더
        "border-b border-[hsl(220,13%,91%)]",
        className
      )}
    >
      {children}
    </thead>
  ),

  th: ({ children, className }) => (
    <th
      className={cn(
        // 패딩
        "px-4 py-3",
        // 텍스트
        "text-left font-medium",
        // 색상
        "text-[hsl(220,9%,35%)]",
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
        "px-4 py-3",
        // 보더
        "border-b border-[hsl(220,13%,91%)]",
        // 색상
        "text-[hsl(220,9%,35%)]",
        className
      )}
    >
      {children}
    </td>
  ),

  // 강조
  strong: ({ children, className }) => (
    <strong
      className={cn("font-semibold", "text-[hsl(220,9%,18%)]", className)}
    >
      {children}
    </strong>
  ),

  em: ({ children, className }) => (
    <em className={cn("italic", className)}>{children}</em>
  ),
};
