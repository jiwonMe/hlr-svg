import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildLlmsFiles, type DocLocale } from "./src/docs/llms";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXAM_CODE_THEME = {
  name: "exam-paper",
  type: "light",
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#0a0a0a",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#9b9b9b", fontStyle: "italic" },
    },
    {
      scope: ["string", "string.template", "punctuation.definition.string"],
      settings: { foreground: "#616161" },
    },
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "keyword.control",
        "keyword.operator.new",
        "constant.language",
      ],
      settings: { foreground: "#0a0a0a", fontStyle: "bold" },
    },
    {
      scope: ["constant.numeric"],
      settings: { foreground: "#0a0a0a" },
    },
  ],
};

// 어두운 화면용: 같은 규칙을 검은 종이 위 흰 분필로.
const EXAM_CODE_THEME_DARK = {
  name: "exam-paper-dark",
  type: "dark",
  colors: {
    "editor.background": "#0a0a0a",
    "editor.foreground": "#ededed",
  },
  tokenColors: EXAM_CODE_THEME.tokenColors.map((rule) => ({
    ...rule,
    settings: {
      ...rule.settings,
      foreground:
        rule.settings.foreground === "#9b9b9b"
          ? "#6e6e6e"
          : rule.settings.foreground === "#616161"
            ? "#a8a8a8"
            : "#ededed",
    },
  })),
};

/**
 * Markdown editions of the docs for language models (llms.txt and friends),
 * built from the MDX sources: served by the dev server, emitted on build.
 */
function llmsDocs(): Plugin {
  const contentDir = path.resolve(__dirname, "src/docs/content");
  const files = () =>
    buildLlmsFiles(
      (["ko-kr", "en-us"] as DocLocale[]).flatMap((locale) =>
        readdirSync(path.join(contentDir, locale))
          .filter((file) => file.endsWith(".mdx"))
          .map((file) => ({
            locale,
            slug: file.replace(/\.mdx$/, ""),
            raw: readFileSync(path.join(contentDir, locale, file), "utf8"),
          })),
      ),
    );
  return {
    name: "llms-docs",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? "").split("?")[0]!).replace(/^\/+/, "");
        const file = files().get(url);
        if (file === undefined) return next();
        res.setHeader(
          "Content-Type",
          `${url.endsWith(".md") ? "text/markdown" : "text/plain"}; charset=utf-8`,
        );
        res.end(file);
      });
    },
    generateBundle() {
      for (const [fileName, source] of files())
        this.emitFile({ type: "asset", fileName, source });
    },
  };
}

export default defineConfig(({ command }) => {
  /**
   * 배포 환경(Vercel/GitHub Pages)은 사이트가 루트(`/`)가 아닐 수 있어요.
   * 빌드 시 `base: "./"`로 **항상 상대경로** 에셋 링크를 만들면,
   * - Vercel(루트)
   * - GitHub Pages(`/repo-name/`)
   * 둘 다에서 CSS/JS가 404 없이 안정적으로 로딩됩니다.
   */
  const base = command === "build" ? "./" : "/";

  return {
    // repoRoot/web 를 Vite root로 사용 (index.html 기준)
    root: __dirname,
    base,
    resolve: {
      alias: {
        "@hlr": path.resolve(__dirname, "../src"),
      },
    },
    plugins: [
      // MDX 플러그인 (React보다 먼저 등록)
      mdx({
        providerImportSource: "@mdx-js/react",
        remarkPlugins: [
          // GFM(테이블, 체크박스 등)
          remarkGfm,
          // YAML frontmatter 파싱
          remarkFrontmatter,
          // frontmatter를 export const frontmatter로 변환
          remarkMdxFrontmatter,
        ],
        rehypePlugins: [
          // 코드 블록 하이라이팅 (Shiki) - GitHub Dark 테마
          [
            rehypePrettyCode,
            {
              // 시험지처럼 흑백: 키워드는 굵게, 문자열과 주석만 회색으로.
              theme: { light: EXAM_CODE_THEME, dark: EXAM_CODE_THEME_DARK },
              keepBackground: false,
            },
          ],
          // 헤딩에 id 추가
          rehypeSlug,
          // 헤딩에 앵커 링크 추가
          rehypeAutolinkHeadings,
        ],
      }),
      react(),
      llmsDocs(),
    ],
    build: {
      // 빌드 출력 디렉토리 (프로젝트 루트의 out/ 폴더로 출력)
      outDir: path.resolve(__dirname, "../out"),
      // 빌드 전 outDir 초기화
      emptyOutDir: true,
      // 모듈 형식 설정
      rollupOptions: {
        output: {
          // ES 모듈 형식으로 출력
          format: "es",
          // 엔트리 파일명 패턴
          entryFileNames: "assets/[name]-[hash].js",
          // 청크 파일명 패턴
          chunkFileNames: "assets/[name]-[hash].js",
          // 에셋 파일명 패턴
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
    server: {
      fs: {
        // web/ 밖의 src/를 직접 import 해서 데모를 렌더링한다.
        allow: [".."],
      },
    },
  };
});
