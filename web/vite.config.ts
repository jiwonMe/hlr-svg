import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // repoRoot/web 를 Vite root로 사용 (index.html 기준)
  root: __dirname,
  plugins: [react()],
  build: {
    // 빌드 출력 디렉토리 (절대 경로로 명확히 지정)
    outDir: path.resolve(__dirname, "dist"),
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
});


