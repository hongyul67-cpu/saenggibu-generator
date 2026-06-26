import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// 배포용 단일 HTML 빌드.
//   - 키를 강제로 비워, .env.local 에 키가 있어도 절대 HTML에 포함되지 않음(받는 사람이 직접 입력).
//   - VITE_DIST=1 로 화면에 '배포용' 배지 표시.
//   npm run build:dist  →  dist-deploy/index.html
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: {
    "import.meta.env.VITE_GEMINI_API_KEY": JSON.stringify(""),
    "import.meta.env.VITE_DIST": JSON.stringify("1"),
  },
  build: {
    outDir: "dist-deploy",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100000,
  },
});
