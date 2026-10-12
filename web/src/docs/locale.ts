export type Locale = "ko-kr" | "en-us";
export const DEFAULT_LOCALE: Locale = "en-us";

/** Labels for the frontmatter `group` names; English uses the names as they are. */
export const GROUP_TITLES: Record<Locale, Record<string, string>> = {
  "ko-kr": {
    "Getting Started": "시작하기",
    Guides: "가이드",
    Tools: "도구",
    Examples: "예제",
    Reference: "레퍼런스",
  },
  "en-us": {},
};
