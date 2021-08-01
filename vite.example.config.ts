import reactRefresh from "@vitejs/plugin-react-refresh";
import path from "path";
import copy from "rollup-plugin-copy";
import { defineConfig } from "vite";
import macrosPlugin from "vite-plugin-babel-macros";

export default defineConfig({
  plugins: [reactRefresh(), macrosPlugin()],
  build: {
    outDir: "public",
    emptyOutDir: true,
    rollupOptions: {
      plugins: [
        copy({
          hook: "writeBundle",
          targets: [
            {
              src: path.resolve(__dirname, "mockServiceWorker.js"),
              dest: path.resolve(__dirname, "public"),
            },
          ],
        }),
      ],
    },
  },
  define: {
    "process.platform": JSON.stringify("win32"),
    "process.env": {},
    "process.versions": {},
  },
});
