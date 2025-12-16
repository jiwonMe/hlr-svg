import React from "react";
import { NavLink, Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { getNavGroups } from "./mdxRegistry";
import { X } from "lucide-react";

interface DocsSidebarProps {
  searchQuery?: string;
  onClose?: () => void;
}

/**
 * 문서 사이드바
 * flex 디자인 시스템 스타일 적용
 */
export function DocsSidebar({
  searchQuery = "",
  onClose,
}: DocsSidebarProps): React.ReactElement {
  const navGroups = getNavGroups();
  const query = searchQuery.toLowerCase().trim();

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.frontmatter.title.toLowerCase().includes(query)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className={cn("flex flex-col h-full")}>
      {/* 헤더: 로고 */}
      <div
        className={cn(
          // 패딩
          "px-5 py-4",
          // 보더
          "border-b border-[hsl(220,13%,91%)]",
          // 플렉스
          "flex items-center justify-between"
        )}
      >
        <Link
          to="/"
          className={cn(
            // 플렉스
            "flex items-center gap-2"
          )}
        >
          {/* 로고 아이콘 */}
          <div
            className={cn(
              // 크기
              "w-8 h-8",
              // 배경
              "bg-[hsl(152,69%,41%)]",
              // 라운드
              "rounded-lg",
              // 플렉스
              "flex items-center justify-center",
              // 텍스트
              "text-white text-sm font-bold"
            )}
          >
            H
          </div>
          <span
            className={cn(
              // 타이포그래피
              "text-base font-semibold",
              // 색상
              "text-[hsl(220,9%,18%)]"
            )}
          >
            HLR.js
          </span>
        </Link>

        {/* 모바일 닫기 버튼 */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              // 패딩
              "p-1.5",
              // 라운드
              "rounded-md",
              // 호버
              "hover:bg-[hsl(220,14%,96%)]",
              // 트랜지션
              "transition-colors"
            )}
          >
            <X className="w-4 h-4 text-[hsl(220,9%,46%)]" />
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <nav
        className={cn(
          // 플렉스
          "flex-1",
          // 오버플로우
          "overflow-y-auto",
          // 패딩
          "py-4"
        )}
      >
        {filteredGroups.map((group) => (
          <div key={group.name} className={cn("mb-6")}>
            {/* 그룹 헤더 */}
            <h3
              className={cn(
                // 패딩
                "px-5 mb-2",
                // 타이포그래피
                "text-xs font-medium uppercase tracking-wider",
                // 색상
                "text-[hsl(220,9%,46%)]"
              )}
            >
              {group.name}
            </h3>

            {/* 그룹 아이템 */}
            <ul>
              {group.items.map((item) => (
                <li key={item.slug}>
                  <NavLink
                    to={`/docs/${item.slug}`}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        // 디스플레이
                        "flex items-center",
                        // 패딩
                        "px-5 py-2",
                        // 타이포그래피
                        "text-sm",
                        // 트랜지션
                        "transition-colors",
                        // 활성 상태
                        isActive
                          ? cn(
                              // 배경
                              "bg-[hsl(152,69%,97%)]",
                              // 색상
                              "text-[hsl(152,69%,35%)]",
                              // 폰트
                              "font-medium",
                              // 좌측 바
                              "border-l-2 border-[hsl(152,69%,41%)]",
                              // 패딩 조정
                              "pl-[18px]"
                            )
                          : cn(
                              // 색상
                              "text-[hsl(220,9%,35%)]",
                              // 호버
                              "hover:bg-[hsl(220,14%,96%)]",
                              "hover:text-[hsl(220,9%,18%)]"
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

        {filteredGroups.length === 0 && (
          <p
            className={cn(
              // 패딩
              "px-5 py-4",
              // 타이포그래피
              "text-sm",
              // 색상
              "text-[hsl(220,9%,46%)]"
            )}
          >
            검색 결과가 없습니다.
          </p>
        )}
      </nav>

      {/* 푸터: 외부 링크 */}
      <div
        className={cn(
          // 패딩
          "px-5 py-4",
          // 보더
          "border-t border-[hsl(220,13%,91%)]"
        )}
      >
        <div className={cn("flex items-center gap-3")}>
          <a
            href="https://github.com/jiwonMe/hlr-svg"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              // 타이포그래피
              "text-xs",
              // 색상
              "text-[hsl(220,9%,46%)]",
              // 호버
              "hover:text-[hsl(220,9%,18%)]",
              // 트랜지션
              "transition-colors"
            )}
          >
            GitHub
          </a>
          <span className="text-[hsl(220,13%,91%)]">·</span>
          <a
            href="https://www.npmjs.com/package/hlr"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              // 타이포그래피
              "text-xs",
              // 색상
              "text-[hsl(220,9%,46%)]",
              // 호버
              "hover:text-[hsl(220,9%,18%)]",
              // 트랜지션
              "transition-colors"
            )}
          >
            npm
          </a>
        </div>
      </div>
    </div>
  );
}
