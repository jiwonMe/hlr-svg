import React from "react";
import { Link, useParams } from "react-router-dom";
import { cn } from "../../lib/utils";
import { EXAMPLES, getGithubUrl } from "./examplesRegistry";

type Locale = "ko-kr" | "en-us";

const TEXT = {
  "ko-kr": {
    title: "Examples",
    subtitle: "three.js examples처럼 각 예제는 별도 페이지에서 인터랙티브하게 동작합니다.",
    open: "열기",
    github: "GitHub 코드",
  },
  "en-us": {
    title: "Examples",
    subtitle: "Each example is an interactive, full-page view (like three.js examples).",
    open: "Open",
    github: "GitHub code",
  },
} as const;

export function DocsExamplesIndexPage(): React.ReactElement {
  const { locale } = useParams<{ locale?: string }>();
  const lang: Locale = locale === "ko-kr" || locale === "en-us" ? locale : "en-us";
  const t = TEXT[lang];

  return (
    <div
      className={cn(
        // 레이아웃
        "w-full",
        // 패딩
        "px-6 py-8"
      )}
    >
      <header
        className={cn(
          // 간격
          "mb-6"
        )}
      >
        <h1
          className={cn(
            // 타이포그래피
            "text-2xl font-semibold tracking-tight",
            // 색상
            "text-[hsl(220,9%,18%)]",
            // 간격
            "mb-2"
          )}
        >
          {t.title}
        </h1>
        <p
          className={cn(
            // 타이포그래피
            "text-[15px] leading-7",
            // 색상
            "text-[hsl(220,9%,35%)]"
          )}
        >
          {t.subtitle}
        </p>
      </header>

      <div
        className={cn(
          // 그리드
          "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
          // 간격
          "gap-4"
        )}
      >
        {EXAMPLES.map((ex) => {
          const info = ex.text[lang];
          const to = `/docs/${lang}/examples/${ex.id}`;
          return (
            <article
              key={ex.id}
              className={cn(
                // 카드
                "rounded-lg",
                "border border-[hsl(220,13%,91%)]",
                "bg-white",
                // 패딩
                "p-5",
                // 레이아웃
                "flex flex-col",
                // 간격
                "gap-3"
              )}
            >
              <div className={cn("min-w-0")}> 
                <h2
                  className={cn(
                    // 타이포그래피
                    "text-base font-semibold",
                    // 색상
                    "text-[hsl(220,9%,18%)]",
                    // 줄바꿈
                    "truncate"
                  )}
                  title={info.title}
                >
                  {info.title}
                </h2>
                <p
                  className={cn(
                    // 타이포그래피
                    "text-sm leading-6",
                    // 색상
                    "text-[hsl(220,9%,46%)]",
                    // 줄바꿈
                    "mt-1"
                  )}
                >
                  {info.description}
                </p>
              </div>

              <div
                className={cn(
                  // 레이아웃
                  "flex items-center gap-3",
                  // 간격
                  "pt-1"
                )}
              >
                <Link
                  to={to}
                  className={cn(
                    // 버튼 느낌
                    "inline-flex items-center justify-center",
                    "h-9",
                    "px-3",
                    // 보더/배경
                    "border border-[hsl(220,13%,91%)]",
                    "rounded-md",
                    "bg-white",
                    // 타이포그래피
                    "text-sm font-medium",
                    // 색상
                    "text-[hsl(220,9%,18%)]",
                    // 호버
                    "hover:bg-[hsl(220,14%,96%)]",
                    // 트랜지션
                    "transition-colors"
                  )}
                >
                  {t.open}
                </Link>

                <a
                  href={getGithubUrl(ex.githubPath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    // 타이포그래피
                    "text-sm font-medium",
                    // 색상
                    "text-[hsl(152,69%,35%)]",
                    // 호버
                    "hover:text-[hsl(152,69%,25%)]",
                    "hover:underline",
                    "underline-offset-4"
                  )}
                >
                  {t.github}
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
