import React, { useState } from "react";
import { Menu, Search, ChevronDown } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { DEFAULT_LOCALE, type Locale } from "./mdxRegistry";

interface DocsTopbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/** 언어 옵션 */
const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "ko-kr", label: "한국어" },
  { value: "en-us", label: "English" },
];

/** 언어별 텍스트 */
const TOPBAR_TEXT = {
  "ko-kr": {
    menuLabel: "메뉴 열기",
    pageTitle: "Documentation",
    searchPlaceholder: "문서 검색...",
  },
  "en-us": {
    menuLabel: "Open menu",
    pageTitle: "Documentation",
    searchPlaceholder: "Search docs...",
  },
} as const;

/**
 * 문서 상단 바
 * flex 디자인 시스템 스타일 적용
 */
export function DocsTopbar({
  searchQuery,
  onSearchChange,
  onToggleSidebar,
}: DocsTopbarProps): React.ReactElement {
  const { locale, slug } = useParams<{ locale: string; slug: string }>();
  const navigate = useNavigate();
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);

  // locale이 유효한지 확인하고 기본값 설정
  const currentLocale: Locale =
    locale === "ko-kr" || locale === "en-us" ? locale : DEFAULT_LOCALE;
  const texts = TOPBAR_TEXT[currentLocale];

  /** 언어 변경 핸들러 */
  const handleLocaleChange = (newLocale: Locale) => {
    setLocaleMenuOpen(false);
    if (newLocale === currentLocale) return;

    // 현재 slug가 있으면 같은 slug로, 없으면 quickstart로 이동
    const targetSlug = slug || "quickstart";
    navigate(`/docs/${newLocale}/${targetSlug}`);
  };
  return (
    <header
      className={cn(
        // 디스플레이
        "flex items-center justify-between",
        // 높이
        "h-14",
        // 패딩
        "px-5",
        // 배경
        "bg-white",
        // 보더
        "border-b border-[hsl(220,13%,91%)]",
        // 고정
        "sticky top-0 z-30"
      )}
    >
      {/* 좌측: 모바일 메뉴 */}
      <div className={cn("flex items-center gap-4")}>
        <button
          type="button"
          onClick={onToggleSidebar}
          className={cn(
            // 모바일에서만
            "md:hidden",
            // 패딩
            "p-2 -ml-2",
            // 라운드
            "rounded-md",
            // 호버
            "hover:bg-[hsl(220,14%,96%)]",
            // 트랜지션
            "transition-colors"
          )}
          aria-label={texts.menuLabel}
        >
          <Menu className="w-5 h-5 text-[hsl(220,9%,35%)]" />
        </button>

        {/* 페이지 타이틀 (데스크탑에서 숨김, 모바일에서 표시) */}
        <span
          className={cn(
            // 모바일에서만
            "md:hidden",
            // 타이포그래피
            "text-base font-medium",
            // 색상
            "text-[hsl(220,9%,18%)]"
          )}
        >
          {texts.pageTitle}
        </span>
      </div>

      {/* 중앙: 검색 */}
      <div
        className={cn(
          // 너비
          "flex-1 max-w-md",
          // 마진
          "mx-4",
          // 숨김 (모바일)
          "hidden md:block"
        )}
      >
        <div className={cn("relative")}>
          <Search
            className={cn(
              // 위치
              "absolute left-3 top-1/2 -translate-y-1/2",
              // 크기
              "w-4 h-4",
              // 색상
              "text-[hsl(220,9%,46%)]"
            )}
          />
          <input
            type="text"
            placeholder={texts.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={cn(
              // 너비
              "w-full",
              // 패딩
              "pl-10 pr-4 py-2",
              // 보더
              "border border-[hsl(220,13%,91%)]",
              // 라운드
              "rounded-lg",
              // 배경
              "bg-[hsl(220,14%,96%)]",
              // 타이포그래피
              "text-sm",
              // 색상
              "text-[hsl(220,9%,18%)]",
              // 포커스
              "focus:outline-none focus:ring-2 focus:ring-[hsl(152,69%,41%)] focus:border-transparent",
              "focus:bg-white",
              // placeholder
              "placeholder:text-[hsl(220,9%,46%)]",
              // 트랜지션
              "transition-all"
            )}
          />
        </div>
      </div>

      {/* 우측: 언어 선택 */}
      <div className={cn("relative")}>
        <button
          type="button"
          onClick={() => setLocaleMenuOpen(!localeMenuOpen)}
          className={cn(
            // 디스플레이
            "flex items-center gap-1.5",
            // 패딩
            "px-3 py-1.5",
            // 보더
            "border border-[hsl(220,13%,91%)]",
            // 라운드
            "rounded-md",
            // 배경
            "bg-white",
            // 타이포그래피
            "text-sm",
            // 색상
            "text-[hsl(220,9%,18%)]",
            // 호버
            "hover:bg-[hsl(220,14%,96%)]",
            // 트랜지션
            "transition-colors"
          )}
        >
          <span>
            {LOCALE_OPTIONS.find((opt) => opt.value === currentLocale)?.label}
          </span>
          <ChevronDown
            className={cn(
              // 크기
              "w-4 h-4",
              // 색상
              "text-[hsl(220,9%,46%)]",
              // 트랜지션
              "transition-transform",
              // 회전
              localeMenuOpen && "rotate-180"
            )}
          />
        </button>

        {/* 언어 선택 드롭다운 */}
        {localeMenuOpen && (
          <>
            <div
              className={cn(
                // 위치
                "fixed inset-0 z-10",
                // 모바일에서만
                "md:hidden"
              )}
              onClick={() => setLocaleMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              className={cn(
                // 위치
                "absolute right-0 top-full mt-1 z-20",
                // 배경
                "bg-white",
                // 보더
                "border border-[hsl(220,13%,91%)]",
                // 라운드
                "rounded-md",
                // 그림자
                "shadow-lg",
                // 최소 너비
                "min-w-[120px]",
                // 오버플로우
                "overflow-hidden"
              )}
            >
              {LOCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleLocaleChange(option.value)}
                  className={cn(
                    // 디스플레이
                    "w-full text-left",
                    // 패딩
                    "px-3 py-2",
                    // 타이포그래피
                    "text-sm",
                    // 트랜지션
                    "transition-colors",
                    // 활성 상태
                    option.value === currentLocale
                      ? cn(
                          // 배경
                          "bg-[hsl(152,69%,97%)]",
                          // 색상
                          "text-[hsl(152,69%,35%)]",
                          // 폰트
                          "font-medium"
                        )
                      : cn(
                          // 색상
                          "text-[hsl(220,9%,18%)]",
                          // 호버
                          "hover:bg-[hsl(220,14%,96%)]"
                        )
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
