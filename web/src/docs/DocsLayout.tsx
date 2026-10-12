import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { SiteHeader } from "../site/SiteHeader";
import { SiteFooter } from "../site/SiteFooter";
import { DocsSearch, LocaleSwitch } from "./DocsTopbar";
import { DocsSidebar } from "./DocsSidebar";
import { DEFAULT_LOCALE, type Locale } from "./mdxRegistry";
import "../site/site.css";
import "./docs.css";

/** Docs share the site header and footer; the page itself scrolls. */
export function DocsLayout(): React.ReactElement {
  const { locale } = useParams<{ locale: string }>();
  const lang: Locale =
    locale === "ko-kr" || locale === "en-us" ? locale : DEFAULT_LOCALE;
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sidebarOpen]);

  return (
    <div className="site docs" lang={lang === "ko-kr" ? "ko" : "en"}>
      <a
        className="skip-link"
        href="#docs-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("docs-main")?.focus();
        }}
      >
        {lang === "ko-kr" ? "본문 바로가기" : "Skip to content"}
      </a>
      <SiteHeader
        locale={lang}
        onMenu={() => setSidebarOpen(true)}
        menuOpen={sidebarOpen}
        wide
      >
        <DocsSearch
          locale={lang}
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <LocaleSwitch locale={lang} />
      </SiteHeader>
      <div className="docs-shell">
        <aside className="docs-sidebar">
          <DocsSidebar locale={lang} searchQuery={searchQuery} />
        </aside>
        {sidebarOpen && (
          <div className="docs-drawer" role="dialog" aria-modal="true">
            <button
              type="button"
              className="docs-drawer-backdrop"
              aria-label={lang === "ko-kr" ? "메뉴 닫기" : "Close menu"}
              onClick={() => setSidebarOpen(false)}
            />
            <div className="docs-drawer-panel">
              <div className="docs-drawer-head">
                <DocsSearch
                  locale={lang}
                  value={searchQuery}
                  onChange={setSearchQuery}
                  inDrawer
                />
                <button
                  type="button"
                  className="docs-drawer-close"
                  onClick={() => setSidebarOpen(false)}
                  aria-label={lang === "ko-kr" ? "메뉴 닫기" : "Close menu"}
                >
                  <X aria-hidden="true" size={18} strokeWidth={1.7} />
                </button>
              </div>
              <DocsSidebar locale={lang} searchQuery={searchQuery} />
            </div>
          </div>
        )}
        <main id="docs-main" className="docs-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <SiteFooter locale={lang} />
    </div>
  );
}
