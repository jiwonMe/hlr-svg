import React from "react";
import { Link } from "react-router-dom";
import { Github, Menu, Search, X } from "lucide-react";
import { cn } from "../lib/utils";

interface DocsTopbarProps {
  /** 검색어 */
  searchQuery: string;
  /** 검색어 변경 핸들러 */
  onSearchChange: (value: string) => void;
  /** 모바일 사이드바 열림 상태 */
  sidebarOpen: boolean;
  /** 모바일 사이드바 토글 */
  onToggleSidebar: () => void;
}

/**
 * 문서 상단 바
 * - 로고/타이틀
 * - 검색 입력
 * - GitHub/NPM 링크
 * - 모바일 메뉴 토글
 */
export function DocsTopbar({
  searchQuery,
  onSearchChange,
  sidebarOpen,
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
        "px-4",
        // 보더
        "border-b border-border",
        // 배경
        "bg-background"
      )}
    >
      {/* 좌측: 로고 + 모바일 메뉴 */}
      <div className={cn("flex items-center gap-4")}>
        {/* 모바일 메뉴 토글 */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={cn(
            // 모바일에서만 표시
            "md:hidden",
            // 패딩
            "p-2",
            // 라운드
            "rounded-md",
            // 호버
            "hover:bg-muted",
            // 트랜지션
            "transition-colors"
          )}
          aria-label={sidebarOpen ? "메뉴 닫기" : "메뉴 열기"}
        >
          {sidebarOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        {/* 로고/타이틀 */}
        <Link
          to="/"
          className={cn(
            // 타이포그래피
            "text-lg font-bold tracking-tight",
            // 색상
            "text-foreground",
            // 호버
            "hover:text-primary",
            // 트랜지션
            "transition-colors"
          )}
        >
          HLR.js
        </Link>

        {/* Docs 라벨 */}
        <span
          className={cn(
            // 배경
            "bg-primary/10",
            // 패딩
            "px-2 py-0.5",
            // 라운드
            "rounded-md",
            // 타이포그래피
            "text-xs font-medium",
            // 색상
            "text-primary"
          )}
        >
          Docs
        </span>
      </div>

      {/* 중앙: 검색 */}
      <div
        className={cn(
          // 디스플레이 (데스크탑에서만)
          "hidden md:flex",
          // 너비
          "flex-1 max-w-md mx-4"
        )}
      >
        <div className={cn("relative w-full")}>
          <Search
            className={cn(
              // 위치
              "absolute left-3 top-1/2 -translate-y-1/2",
              // 크기
              "w-4 h-4",
              // 색상
              "text-muted-foreground"
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
              "border border-input",
              // 라운드
              "rounded-md",
              // 배경
              "bg-background",
              // 타이포그래피
              "text-sm",
              // 포커스
              "focus:outline-none focus:ring-2 focus:ring-ring",
              // placeholder
              "placeholder:text-muted-foreground"
            )}
          />
        </div>
      </div>

      {/* 우측: 외부 링크 */}
      <div className={cn("flex items-center gap-2")}>
        {/* GitHub */}
        <a
          href="https://github.com/jiwonMe/hlr-svg"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            // 패딩
            "p-2",
            // 라운드
            "rounded-md",
            // 색상
            "text-muted-foreground",
            // 호버
            "hover:text-foreground hover:bg-muted",
            // 트랜지션
            "transition-colors"
          )}
          aria-label="GitHub"
        >
          <Github className="w-5 h-5" />
        </a>

        {/* NPM */}
        <a
          href="https://www.npmjs.com/package/hlr"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            // 패딩
            "p-2",
            // 라운드
            "rounded-md",
            // 색상
            "text-muted-foreground",
            // 호버
            "hover:text-foreground hover:bg-muted",
            // 트랜지션
            "transition-colors"
          )}
          aria-label="npm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z" />
          </svg>
        </a>
      </div>
    </header>
  );
}
