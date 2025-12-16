import React from "react";
import { Menu, Search } from "lucide-react";
import { cn } from "../lib/utils";

interface DocsTopbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/**
 * 문서 상단 바
 * flex 디자인 시스템 스타일 적용
 */
export function DocsTopbar({
  searchQuery,
  onSearchChange,
  onToggleSidebar,
}: DocsTopbarProps): React.ReactElement {
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
          aria-label="메뉴 열기"
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
          Documentation
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
            placeholder="문서 검색..."
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

      {/* 우측: 빈 공간 (링크는 사이드바 하단으로 이동) */}
      <div className={cn("w-10 md:w-0")} />
    </header>
  );
}
