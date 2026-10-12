import React from "react";
import { NavLink } from "react-router-dom";
import { getNavGroups, type Locale } from "./mdxRegistry";

const TEXT = {
  "ko-kr": {
    label: "문서 목차",
    noResults: "찾는 문서가 없습니다.",
    gallery: "예제 갤러리",
    groups: {
      "Getting Started": "시작하기",
      Examples: "예제",
      Reference: "레퍼런스",
    } as Record<string, string>,
  },
  "en-us": {
    label: "Documentation",
    noResults: "No matching pages.",
    gallery: "Example gallery",
    groups: {} as Record<string, string>,
  },
} as const;

type NavItem = { to: string; title: string; exact: boolean };

/** Docs pages numbered like exam questions, grouped by section. */
export function DocsSidebar({
  locale,
  searchQuery = "",
}: {
  locale: Locale;
  searchQuery?: string;
}): React.ReactElement {
  const t = TEXT[locale];
  const query = searchQuery.toLowerCase().trim();
  const groups = getNavGroups(locale)
    .map((group) => {
      const items: NavItem[] = group.items.map((item) => ({
        to: `/docs/${locale}/${item.slug}`,
        title: item.frontmatter.title,
        exact: true,
      }));
      // The interactive gallery is a route, not an MDX page.
      if (group.name === "Examples")
        items.unshift({
          to: `/docs/${locale}/examples`,
          title: t.gallery,
          exact: false,
        });
      return {
        name: t.groups[group.name] ?? group.name,
        items: items.filter((item) => item.title.toLowerCase().includes(query)),
      };
    })
    .filter((group) => group.items.length > 0);

  let number = 0;
  return (
    <nav className="docs-nav" aria-label={t.label}>
      {groups.map((group) => (
        <section key={group.name} className="docs-nav-group">
          <h2 className="docs-nav-title">{group.name}</h2>
          <ul>
            {group.items.map((item) => {
              number += 1;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) =>
                      isActive ? "docs-nav-link is-active" : "docs-nav-link"
                    }
                  >
                    <span className="docs-nav-no" aria-hidden="true">
                      {number}.
                    </span>
                    <span>{item.title}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <p className="docs-nav-empty">{t.noResults}</p>}
    </nav>
  );
}
