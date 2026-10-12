export type SiteLocale = "ko-kr" | "en-us";

export const GITHUB_URL = "https://github.com/jiwonMe/hlr-svg";
export const NPM_URL = "https://www.npmjs.com/package/hlr";
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
export const INSTALL_COMMAND = "pnpm add hlr";

const TEXT = {
  "ko-kr": {
    home: "HLR SVG 처음 화면",
    mainNav: "주 메뉴",
    openMenu: "문서 메뉴 열기",
    docs: "문서",
    examples: "예제",
    playground: "도형 작업실",
    start: "시작하기",
    copy: (command: string) => `설치 명령어 ${command} 복사`,
    copied: "복사했습니다",
    copyFailed: "직접 입력해 주세요",
    motto: "보이는 선은 실선으로, 가려진 선은 점선으로.",
    footerStart: "시작하기",
    quickstart: "빠른 시작",
    api: "API 레퍼런스",
    gallery: "예제 갤러리",
    footerTools: "도구",
    footerAbout: "정보",
    license: "MIT 라이선스",
    fonts: "글꼴 · 부크크 고딕·명조, Pretendard",
    status: "이 사이트의 그림은 모두 HLR SVG로 렌더링했습니다",
    notice: "실제 시험 문항이 아닙니다.",
    theme: "화면 테마",
    themeSystem: "시스템 설정 따르기",
    themeLight: "밝은 화면",
    themeDark: "어두운 화면",
    toDark: "어두운 화면으로",
    toLight: "밝은 화면으로",
  },
  "en-us": {
    home: "HLR SVG home",
    mainNav: "Main",
    openMenu: "Open docs menu",
    docs: "Docs",
    examples: "Examples",
    playground: "Playground",
    start: "Get started",
    copy: (command: string) => `Copy install command ${command}`,
    copied: "Copied",
    copyFailed: "Type it manually",
    motto: "Visible lines solid, hidden lines dashed.",
    footerStart: "Start",
    quickstart: "Quick start",
    api: "API reference",
    gallery: "Example gallery",
    footerTools: "Tools",
    footerAbout: "About",
    license: "MIT License",
    fonts: "Fonts · Bookk Gothic & Myungjo, Pretendard",
    status: "Every figure on this site is rendered with HLR SVG",
    notice: "Not real exam questions.",
    theme: "Theme",
    themeSystem: "Match system",
    themeLight: "Light",
    themeDark: "Dark",
    toDark: "Switch to dark theme",
    toLight: "Switch to light theme",
  },
} as const;

export function siteText(locale: SiteLocale) {
  return TEXT[locale];
}
