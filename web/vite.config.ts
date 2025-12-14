import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

export default defineConfig({
  // repoRoot/web 를 Vite root로 사용 (index.html 기준)
  root: path.dirname(fileURLToPath(import.meta.url)),
  plugins: [react()],
  server: {
    fs: {
      // web/ 밖의 dist/를 import 해서 데모를 렌더링한다.
      allow: [".."],
    },
  },
});


