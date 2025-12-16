import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
          // 헤딩에 id 추가
          rehypeSlug,
          // 헤딩에 앵커 링크 추가
          rehypeAutolinkHeadings,
        ],
      }),
      react(),
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
        // web/ 밖의 dist/를 import 해서 데모를 렌더링한다.
        allow: [".."],
      },
    },
  };
});


