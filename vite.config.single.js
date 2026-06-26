import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// 모든 JS/CSS를 index.html 하나에 인라인 → Node 설치 없이 더블클릭으로 실행 가능한 단일 파일 빌드.
//   npm run build:single  →  dist-single/index.html
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist-single",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100000,
  },
});
