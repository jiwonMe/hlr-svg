import React, { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { DEFAULT_LOCALE, type Locale } from "./mdxRegistry";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

/** 언어별 텍스트 */
const TOC_TEXT = {
  "ko-kr": { title: "이 페이지의 문항" },
  "en-us": { title: "On this page" },
} as const;

/**
 * 문서 목차 (Table of Contents)
 * 우측에 고정되어 표시되며, 현재 섹션을 하이라이트
 */
export function DocsToc(): React.ReactElement {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const location = useLocation();
  const { locale } = useParams<{ locale: string }>();
  const observerRef = useRef<IntersectionObserver | null>(null);

  // locale이 유효한지 확인하고 기본값 설정
  const validLocale: Locale =
    locale === "ko-kr" || locale === "en-us" ? locale : DEFAULT_LOCALE;
  const texts = TOC_TEXT[validLocale];

  useEffect(() => {
    const scrollContainer = document.querySelector<HTMLElement>("#docs-scroll");

    // 이전 observer 정리
    observerRef.current?.disconnect();
    observerRef.current = null;

    let cancelled = false;
    let rafId = 0;
    let tries = 0;

    const collectHeadings = (): TocItem[] => {
      const els = document.querySelectorAll<HTMLElement>(
        "article h2[id], article h3[id]",
      );
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

      const headingElements = document.querySelectorAll<HTMLElement>(
        "article h2[id], article h3[id]",
      );

      // 실제 스크롤 컨테이너 결정 (main이 스크롤 가능하면 main, 아니면 window)
      const root =
        scrollContainer &&
        scrollContainer.scrollHeight > scrollContainer.clientHeight + 1
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
        },
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

    const offset = 88; // 고정 머리말 높이 보정

    // main 스크롤 컨테이너가 실제로 스크롤을 담당하는 경우: 컨테이너 기준으로 계산해서 한 번에 scrollTo
    if (
      scrollContainer &&
      scrollContainer.scrollHeight > scrollContainer.clientHeight + 1
    ) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const top =
        elementRect.top -
        containerRect.top +
        scrollContainer.scrollTop -
        offset;

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
    <aside className="docs-toc" aria-labelledby="docs-toc-title">
      <h2 id="docs-toc-title" className="docs-toc-title">
        {texts.title}
      </h2>
      {headings.length > 0 && (
        <ul>
          {headings.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleClick(item.id)}
                aria-current={activeId === item.id ? "location" : undefined}
                className={item.level === 3 ? "is-sub" : undefined}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
