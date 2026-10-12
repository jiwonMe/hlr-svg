/**
 * Plain-Markdown editions of the docs for language models, following
 * https://llmstxt.org: an index (llms.txt), every page in one file per
 * language (llms-full*.txt) and one .md file per page. Built from the MDX
 * sources at build time (see web/vite.config.ts); no DOM or Node APIs here.
 */

export const SITE_URL = "https://hlr.js.org";

export type DocLocale = "ko-kr" | "en-us";
export type DocSource = { locale: DocLocale; slug: string; raw: string };

type Page = {
  locale: DocLocale;
  slug: string;
  title: string;
  description: string;
  order: number;
  body: string;
};

function parse(source: DocSource): Page {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source.raw);
  const fields: Record<string, string> = {};
  for (const line of (match?.[1] ?? "").split("\n")) {
    const at = line.indexOf(":");
    if (at > 0)
      fields[line.slice(0, at).trim()] = line
        .slice(at + 1)
        .trim()
        .replace(/^"(.*)"$/, "$1");
  }
  return {
    locale: source.locale,
    slug: source.slug,
    title: fields.title ?? source.slug,
    description: fields.description ?? "",
    order: Number(fields.order ?? 999),
    body: source.raw.slice(match?.[0].length ?? 0).trim(),
  };
}

export const pageMarkdownPath = (locale: DocLocale, slug: string) =>
  `docs/${locale}/${slug}.md`;

/** Site links become absolute: pages point at their .md, app routes at the site. */
function absoluteLinks(markdown: string): string {
  return markdown.replace(/\]\((\/[^)\s]*)\)/g, (whole, href: string) => {
    const page = /^\/docs\/(ko-kr|en-us)\/([\w-]+)$/.exec(href);
    if (page && page[2] !== "examples")
      return `](${SITE_URL}/${pageMarkdownPath(page[1] as DocLocale, page[2]!)})`;
    return `](${SITE_URL}/#${href})`;
  });
}

function pageMarkdown(page: Page): string {
  const lede = page.description ? `> ${page.description}\n\n` : "";
  return `# ${page.title}\n\n${lede}${absoluteLinks(page.body)}\n`;
}

/** A section of a page by its heading, without the heading itself. */
function section(page: Page | undefined, heading: string): string {
  if (!page) return "";
  const lines = page.body.split("\n");
  const start = lines.findIndex((line) => line === `## ${heading}`);
  if (start < 0) return "";
  const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join("\n")
    .trim();
}

const SUMMARY =
  "hlr is a TypeScript library that renders 3D shapes as SVG line drawings with hidden line " +
  "removal: visible lines solid, hidden lines dashed, like figures in math textbooks and exams. " +
  "ES module, no dependencies, runs in Node.js 20+ and browsers.";

const MINIMAL_EXAMPLE = `\`\`\`typescript
import { Camera, PlaneRect, Scene, Sphere, SvgRenderer, Vec3 } from "hlr";

const scene = new Scene([
  new Sphere("S", new Vec3(0, 1, 0), 1.5),
  new PlaneRect("alpha", new Vec3(0, 0, 0), new Vec3(0, 1, 0), new Vec3(1, 0, 0), 3, 3),
]);
const camera = Camera.from({
  kind: "orthographic",
  position: new Vec3(6, 5, 8),
  target: new Vec3(0, 0.6, 0),
  up: new Vec3(0, 1, 0),
  halfHeight: 3,
  aspect: 640 / 480,
  near: 0.1,
  far: 100,
});
const svg = new SvgRenderer({ width: 640, height: 480 }).render(scene, camera); // an SVG string
\`\`\``;

function sorted(pages: Page[], locale: DocLocale): Page[] {
  return pages
    .filter((page) => page.locale === locale)
    .sort((a, b) => a.order - b.order);
}

function index(pages: Page[]): string {
  const english = sorted(pages, "en-us");
  const korean = sorted(pages, "ko-kr");
  const list = (items: Page[]) =>
    items
      .map(
        (page) =>
          `- [${page.title}](${SITE_URL}/${pageMarkdownPath(page.locale, page.slug)}): ${page.description}`,
      )
      .join("\n");
  const rules = section(
    english.find((page) => page.slug === "llms"),
    "What models often get wrong",
  ).replace(/^The same list opens `llms.txt`.\n+/, "");
  return [
    "# hlr",
    "",
    `> ${SUMMARY}`,
    "",
    `Install with \`pnpm add hlr\` (npm package \`hlr\`). Website: ${SITE_URL} · Source: https://github.com/jiwonMe/hlr-svg · License: MIT.`,
    "",
    "## Rules that are easy to get wrong",
    "",
    rules,
    "",
    "## Minimal example",
    "",
    MINIMAL_EXAMPLE,
    "",
    "## Docs",
    "",
    list(english),
    "",
    "## Docs in Korean (한국어)",
    "",
    list(korean),
    "",
    "## Optional",
    "",
    `- [Every English page in one file](${SITE_URL}/llms-full.txt): the full documentation for a model's context`,
    `- [Every Korean page in one file](${SITE_URL}/llms-full.ko.txt): 한국어 문서 전체`,
    `- [Interactive example gallery](${SITE_URL}/#/docs/en-us/examples): live figures with their source code`,
    `- [Shape studio](${SITE_URL}/#/playground): a no-code editor that exports SVG, PNG and TypeScript`,
    "",
  ].join("\n");
}

function full(pages: Page[], locale: DocLocale): string {
  const head =
    locale === "en-us"
      ? `# hlr documentation\n\n> ${SUMMARY}\n\nEvery page of ${SITE_URL}/#/docs/en-us, in reading order. Install with \`pnpm add hlr\`.`
      : `# hlr 문서\n\n> 3차원 도형을 숨은선 제거 SVG 선 그림으로 렌더링하는 TypeScript 라이브러리입니다. 보이는 선은 실선, 가려진 선은 점선으로 그립니다.\n\n${SITE_URL}/#/docs/ko-kr 의 모든 문서를 읽는 순서대로 담았습니다. 설치: \`pnpm add hlr\`.`;
  return `${[head, ...sorted(pages, locale).map(pageMarkdown)].join("\n\n---\n\n")}`;
}

/** Every generated file, keyed by its path from the site root. */
export function buildLlmsFiles(sources: readonly DocSource[]): Map<string, string> {
  const pages = sources.map(parse);
  const files = new Map<string, string>([
    ["llms.txt", index(pages)],
    ["llms-full.txt", full(pages, "en-us")],
    ["llms-full.ko.txt", full(pages, "ko-kr")],
  ]);
  for (const page of pages)
    files.set(pageMarkdownPath(page.locale, page.slug), pageMarkdown(page));
  return files;
}
