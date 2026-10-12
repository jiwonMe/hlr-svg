import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeButton } from "./ThemeToggle";
import { GITHUB_URL, siteText, type SiteLocale } from "./siteText";

export type SiteHeaderProps = {
  locale?: SiteLocale;
  /** Opens the docs sidebar on small screens instead of the site menu. */
  onMenu?: () => void;
  menuOpen?: boolean;
  /** Spans the whole window, as the docs layout does. */
  wide?: boolean;
  /** Docs place search and the language switch here. */
  children?: React.ReactNode;
};

export function SiteHeader({
  locale = "ko-kr",
  onMenu,
  menuOpen,
  wide = false,
  children,
}: SiteHeaderProps): React.ReactElement {
  const t = siteText(locale);
  const docs = `/docs/${locale}`;
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "is-active" : undefined;

  useEffect(() => setNavOpen(false), [pathname]);

  const links = (
    <>
      <NavLink to={`${docs}/quickstart`} className={navClass}>
        {t.docs}
      </NavLink>
      <NavLink to={`${docs}/examples`} className={navClass}>
        {t.examples}
      </NavLink>
      <NavLink to="/playground" className={navClass}>
        {t.playground}
      </NavLink>
      <a href={GITHUB_URL} target="_blank" rel="noreferrer">
        GitHub
        <ArrowUpRight aria-hidden="true" size={13} strokeWidth={1.8} />
      </a>
    </>
  );

  return (
    <header className="site-header">
      <div className={wide ? "site-header-inner is-wide" : "site-header-inner"}>
        {onMenu && (
          <button
            type="button"
            className="site-menu"
            onClick={onMenu}
            aria-label={t.openMenu}
            aria-expanded={menuOpen}
          >
            <Menu aria-hidden="true" size={19} strokeWidth={1.7} />
          </button>
        )}
        <Link to="/" className="site-logo" aria-label={t.home}>
          <Logo />
        </Link>
        <nav className="site-nav" aria-label={t.mainNav}>
          {links}
        </nav>
        <div className="site-header-end">
          {children}
          <ThemeButton locale={locale} />
          <Link className="btn btn-primary btn-sm" to={`${docs}/quickstart`}>
            {t.start}
          </Link>
          {!onMenu && (
            <button
              type="button"
              className="site-menu"
              onClick={() => setNavOpen((open) => !open)}
              aria-label={t.mainNav}
              aria-expanded={navOpen}
              aria-controls="site-mobile-nav"
            >
              {navOpen ? (
                <X aria-hidden="true" size={19} strokeWidth={1.7} />
              ) : (
                <Menu aria-hidden="true" size={19} strokeWidth={1.7} />
              )}
            </button>
          )}
        </div>
      </div>
      {!onMenu && navOpen && (
        <nav
          id="site-mobile-nav"
          className="site-mobile-nav"
          aria-label={t.mainNav}
        >
          {links}
        </nav>
      )}
    </header>
  );
}
