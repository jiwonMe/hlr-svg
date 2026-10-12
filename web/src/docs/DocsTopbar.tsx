import React from "react";
import { Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Locale } from "./mdxRegistry";

const TEXT = {
  "ko-kr": { search: "문서 찾기", language: "언어" },
  "en-us": { search: "Search docs", language: "Language" },
} as const;

/** Filters the sidebar as you type. */
export function DocsSearch({
  locale,
  value,
  onChange,
  inDrawer = false,
}: {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  inDrawer?: boolean;
}): React.ReactElement {
  return (
    <label className={inDrawer ? "docs-search is-drawer" : "docs-search"}>
      <Search aria-hidden="true" size={15} strokeWidth={1.8} />
      <span className="sr-only">{TEXT[locale].search}</span>
      <input
        type="search"
        placeholder={TEXT[locale].search}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

const LOCALES: readonly { value: Locale; label: string; name: string }[] = [
  { value: "ko-kr", label: "KO", name: "한국어" },
  { value: "en-us", label: "EN", name: "English" },
];

/** Keeps the current page when switching languages. */
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div
      className="seg seg-sm docs-locale"
      role="group"
      aria-label={TEXT[locale].language}
    >
      {LOCALES.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value === "ko-kr" ? "ko" : "en"}
          aria-label={option.name}
          aria-pressed={option.value === locale}
          onClick={() => {
            if (option.value === locale) return;
            navigate(
              pathname.replace(
                /^\/docs\/(ko-kr|en-us)/,
                `/docs/${option.value}`,
              ),
            );
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
