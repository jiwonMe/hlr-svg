import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "../lib/utils";
import { DocsTopbar } from "./DocsTopbar";
import { DocsSidebar } from "./DocsSidebar";

/**
 * 문서 레이아웃
 * - 상단 바 (검색, 링크)
 * - 좌측 사이드바 (네비게이션)
 * - 메인 콘텐츠 (Outlet)
 * - 모바일 반응형 지원
 */
export function DocsLayout(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className={cn(
        // 전체 화면
        "min-h-screen",
        // 배경
        "bg-background"
      )}
      style={{
        fontFamily: "var(--font-docs)",
      }}
    >
      {/* 상단 바 */}
      <DocsTopbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className={cn("flex", "h-[calc(100vh-3.5rem)]")}>
        {/* 데스크탑 사이드바 */}
        <aside
          className={cn(
            // 숨김 (모바일)
            "hidden md:block",
            // 보더
            "border-r border-border",
            // 배경
            "bg-card",
            // 너비
            "w-64 shrink-0",
            // 오버플로우
            "overflow-y-auto"
          )}
        >
          <DocsSidebar searchQuery={searchQuery} />
        </aside>

        {/* 모바일 사이드바 오버레이 */}
        {sidebarOpen && (
          <>
            {/* 배경 오버레이 */}
            <div
              className={cn(
                // 위치
                "fixed inset-0 z-40",
                // 배경
                "bg-black/50",
                // 모바일에서만
                "md:hidden"
              )}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />

            {/* 모바일 사이드바 */}
            <aside
              className={cn(
                // 위치
                "fixed inset-y-0 left-0 z-50",
                // 상단 여백 (Topbar 높이)
                "top-14",
                // 보더
                "border-r border-border",
                // 배경
                "bg-card",
                // 너비
                "w-64",
                // 모바일에서만
                "md:hidden",
                // 애니메이션
                "animate-in slide-in-from-left duration-200"
              )}
            >
              <DocsSidebar
                searchQuery={searchQuery}
                onClose={() => setSidebarOpen(false)}
              />
            </aside>
          </>
        )}

        {/* 메인 콘텐츠 */}
        <main
          className={cn(
            // 플렉스
            "flex-1",
            // 오버플로우
            "overflow-y-auto",
            // 배경
            "bg-background"
          )}
        >
          {/* 카드 컨테이너 */}
          <div
            className={cn(
              // 마진
              "m-4 md:m-6",
              // 배경
              "bg-card",
              // 보더
              "border border-border",
              // 라운드
              "rounded-lg",
              // 그림자
              "shadow-sm",
              // 최소 높이
              "min-h-[calc(100%-2rem)] md:min-h-[calc(100%-3rem)]"
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
