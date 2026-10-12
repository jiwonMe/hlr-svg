import React from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import {
  GITHUB_URL,
  LICENSE_URL,
  NPM_URL,
  siteText,
  type SiteLocale,
} from "./siteText";

export function SiteFooter({
  locale = "ko-kr",
}: {
  locale?: SiteLocale;
}): React.ReactElement {
  const t = siteText(locale);
  const docs = `/docs/${locale}`;
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link to="/" aria-label={t.home}>
            <Logo />
          </Link>
          <p>{t.motto}</p>
        </div>
        <nav className="site-footer-cols" aria-label={t.mainNav}>
          <div>
            <h2>{t.footerStart}</h2>
            <Link to={`${docs}/quickstart`}>{t.quickstart}</Link>
            <Link to={`${docs}/api`}>{t.api}</Link>
            <Link to={`${docs}/examples`}>{t.gallery}</Link>
          </div>
          <div>
            <h2>{t.footerTools}</h2>
            <Link to="/playground">{t.playground}</Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={NPM_URL} target="_blank" rel="noreferrer">
              npm
            </a>
          </div>
          <div>
            <h2>{t.footerAbout}</h2>
            <a href={LICENSE_URL} target="_blank" rel="noreferrer">
              {t.license}
            </a>
            <span>{t.fonts}</span>
          </div>
        </nav>
      </div>
      <div className="site-footer-base">
        <p className="site-status">
          <span className="site-status-dot" aria-hidden="true" />
          {t.status}
        </p>
        <p>{t.notice}</p>
      </div>
    </footer>
  );
}
