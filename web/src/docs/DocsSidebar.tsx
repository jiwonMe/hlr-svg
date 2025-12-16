import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import { getNavGroups } from "./mdxRegistry";

interface DocsSidebarProps {
  /** 검색 필터 (Topbar에서 전달) */
  searchQuery?: string;
  /** 모바일에서 사이드바 닫기 콜백 */
  onClose?: () => void;
}

/**
 * 문서 사이드바 네비게이션
 * - 그룹별로 문서 목록 표시
 * - 현재 페이지 강조
 * - 검색 필터링 지원
 */
export function DocsSidebar({
  searchQuery = "",
  onClose,
}: DocsSidebarProps): React.ReactElement {
  const navGroups = getNavGroups();
  const query = searchQuery.toLowerCase().trim();

  // 검색어로 필터링
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.frontmatter.title.toLowerCase().includes(query)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <nav
      className={cn(
        // 너비
        "w-64",
        // 높이
        "h-full",
        // 오버플로우
        "overflow-y-auto",
        // 패딩
        "py-6 px-4"
      )}
    >
      {filteredGroups.map((group) => (
        <div key={group.name} className={cn("mb-6")}>
          {/* 그룹 헤더 */}
          <h3
            className={cn(
              // 타이포그래피
              "text-xs font-semibold uppercase tracking-wider",
              // 색상
              "text-muted-foreground",
              // 마진
              "mb-2 px-2"
            )}
          >
            {group.name}
          </h3>

          {/* 그룹 아이템 */}
          <ul className={cn("space-y-1")}>
            {group.items.map((item) => (
              <li key={item.slug}>
                <NavLink
                  to={`/docs/${item.slug}`}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      // 디스플레이
                      "block",
                      // 패딩
                      "px-3 py-2",
                      // 라운드
                      "rounded-md",
                      // 타이포그래피
                      "text-sm",
                      // 트랜지션
                      "transition-colors",
                      // 활성 상태
                      isActive
                        ? cn(
                            // 배경
                            "bg-primary/10",
                            // 색상
                            "text-primary",
                            // 폰트
                            "font-medium",
                            // 좌측 바
                            "border-l-2 border-primary"
                          )
                        : cn(
                            // 색상
                            "text-foreground",
                            // 호버
                            "hover:bg-muted",
                            "hover:text-foreground"
                          )
                    )
                  }
                >
                  {item.frontmatter.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* 필터 결과 없음 */}
      {filteredGroups.length === 0 && (
        <p
          className={cn(
            // 타이포그래피
            "text-sm",
            // 색상
            "text-muted-foreground",
            // 패딩
            "px-2 py-4"
          )}
        >
          검색 결과가 없습니다.
        </p>
      )}
    </nav>
  );
}
