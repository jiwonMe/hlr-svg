import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

/**
 * 문서 목차 (Table of Contents)
 * 우측에 고정되어 표시되며, 현재 섹션을 하이라이트
 */
export function DocsToc(): React.ReactElement {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const location = useLocation();
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>("#docs-scroll");

    // 이전 observer 정리
    observerRef.current?.disconnect();
    observerRef.current = null;

    let cancelled = false;
    let rafId = 0;
    let tries = 0;

    const collectHeadings = (): TocItem[] => {
      const els = document.querySelectorAll<HTMLElement>("article h2[id], article h3[id]");
      return Array.from(els).map((el) => ({
        id: el.id,
        text: el.textContent || "",
        level: parseInt(el.tagName.charAt(1), 10),
      }));
    };

    const setup = () => {
      if (cancelled) return;

      const tocItems = collectHeadings();
      if (tocItems.length === 0 && tries < 10) {
        tries += 1;
        rafId = requestAnimationFrame(setup);
        return;
      }

      setHeadings(tocItems);
      if (tocItems.length > 0) setActiveId((prev) => prev || tocItems[0]!.id);

      const headingElements = document.querySelectorAll<HTMLElement>("article h2[id], article h3[id]");

      // 실제 스크롤 컨테이너 결정 (main이 스크롤 가능하면 main, 아니면 window)
      const root =
        scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight + 1
          ? scrollContainer
          : null;

      const observer = new IntersectionObserver(
        (entries) => {
          // 가장 많이 보이는 항목을 active로
          let best: IntersectionObserverEntry | null = null;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            if (!best || entry.intersectionRatio > best.intersectionRatio) {
              best = entry;
            }
          }
          if (best?.target?.id) setActiveId(best.target.id);
        },
        {
          root,
          rootMargin: "-80px 0px -66% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1],
        }
      );

      headingElements.forEach((el) => observer.observe(el));
      observerRef.current = observer;
    };

    rafId = requestAnimationFrame(setup);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [location.pathname]);

  const handleClick = (id: string) => {
    const scrollContainer = document.querySelector<HTMLElement>("#docs-scroll");
    const element = document.getElementById(id);
    if (!element) return;

    // 클릭 시 즉시 active 반영
    setActiveId(id);

    const offset = 80; // Topbar 높이 보정

    // main 스크롤 컨테이너가 실제로 스크롤을 담당하는 경우: 컨테이너 기준으로 계산해서 한 번에 scrollTo
    if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight + 1) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const top =
        elementRect.top - containerRect.top + scrollContainer.scrollTop - offset;

      scrollContainer.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
      return;
    }

    // fallback: window 스크롤
    const top = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  return (
    <aside
      className={cn(
        // 숨김 (모바일)
        "hidden lg:block",
        // 너비
        "w-56 shrink-0",
        // 패딩
        "pl-6 pr-4 py-6",
        // 보더
        "border-l border-[hsl(220,13%,91%)]",
        // sticky (상단바 높이만큼)
        "sticky top-14",
        // 높이 (상단바 제외)
        "h-[calc(100vh-3.5rem)]",
        // TOC 자체 스크롤
        "overflow-y-auto"
      )}
    >
      <h3
        className={cn(
          // 타이포그래피
          "text-xs font-semibold uppercase tracking-wider",
          // 색상
          "text-[hsl(220,9%,46%)]",
          // 마진
          "mb-3"
        )}
      >
        목차
      </h3>
      <nav>
        {headings.length === 0 ? (
          <p
            className={cn(
              // 타이포그래피
              "text-xs",
              // 색상
              "text-[hsl(220,9%,46%)]"
            )}
          >
            로딩 중...
          </p>
        ) : (
          <ul className={cn("space-y-1")}>
            {headings.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleClick(item.id)}
                  className={cn(
                    // 디스플레이
                    "block w-full text-left",
                    // 패딩
                    "px-2 py-1.5",
                    // 라운드
                    "rounded-md",
                    // 타이포그래피
                    "text-xs leading-5",
                    // 트랜지션
                    "transition-colors",
                    // 레벨별 들여쓰기
                    item.level === 3 && "pl-4",
                    // 활성 상태
                    activeId === item.id
                      ? cn(
                          // 색상
                          "text-[hsl(152,69%,35%)]",
                          // 폰트
                          "font-semibold",
                          // 배경
                          "bg-[hsl(152,69%,97%)]"
                        )
                      : cn(
                          // 색상
                          "text-[hsl(220,9%,46%)]",
                          // 호버
                          "hover:text-[hsl(220,9%,18%)]",
                          "hover:bg-[hsl(220,14%,96%)]"
                        )
                  )}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
