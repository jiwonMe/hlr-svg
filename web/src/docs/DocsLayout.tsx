import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "../lib/utils";
import { DocsTopbar } from "./DocsTopbar";
import { DocsSidebar } from "./DocsSidebar";

/**
 * 문서 레이아웃
 * flex 디자인 시스템 스타일 적용
 * - 좌측 사이드바 (흰색)
 * - 상단 헤더
 * - 메인 콘텐츠 (연한 회색 배경 + 흰색 카드)
 */
export function DocsLayout(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className={cn(
        // 전체 화면
        "min-h-screen",
        // 플렉스 레이아웃
        "flex"
      )}
      style={{ fontFamily: "var(--font-docs)" }}
    >
      {/* 데스크탑 사이드바 */}
      <aside
        className={cn(
          // 숨김 (모바일)
          "hidden md:flex md:flex-col",
          // 너비
          "w-60 shrink-0",
          // 배경 (흰색)
          "bg-white",
          // 보더
          "border-r border-[hsl(220,13%,91%)]",
          // 높이
          "h-screen",
          // 고정
          "sticky top-0"
        )}
      >
        <DocsSidebar searchQuery={searchQuery} />
      </aside>

      {/* 모바일 사이드바 오버레이 */}
      {sidebarOpen && (
        <>
          <div
            className={cn(
              // 위치
              "fixed inset-0 z-40",
              // 배경
              "bg-black/40",
              // 모바일에서만
              "md:hidden"
            )}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside
            className={cn(
              // 위치
              "fixed inset-y-0 left-0 z-50",
              // 배경
              "bg-white",
              // 너비
              "w-60",
              // 모바일에서만
              "md:hidden",
              // 그림자
              "shadow-xl"
            )}
          >
            <DocsSidebar
              searchQuery={searchQuery}
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </>
      )}

      {/* 메인 영역 */}
      <div
        className={cn(
          // 플렉스
          "flex-1 flex flex-col",
          // 최소 너비
          "min-w-0"
        )}
      >
        {/* 상단 바 */}
        <DocsTopbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* 메인 콘텐츠 */}
        <main
          className={cn(
            // 플렉스
            "flex-1",
            // 배경 (연한 회색)
            "bg-[hsl(220,14%,96%)]",
            // 오버플로우
            "overflow-y-auto"
          )}
        >
          {/* 카드 컨테이너 */}
          <div
            className={cn(
              // 마진
              "m-5",
              // 배경 (흰색)
              "bg-white",
              // 라운드
              "rounded-lg",
              // 그림자
              "shadow-sm",
              // 최소 높이
              "min-h-[calc(100vh-5.5rem)]"
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
