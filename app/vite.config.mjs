import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    // fail closed: 既定はループバック限定。Codex内蔵プレビュー等の外部bindは
    // `npm run dev -- --host <addr>` の明示指定でのみ開く (SECURITY.md の境界)。
    host: "127.0.0.1",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
