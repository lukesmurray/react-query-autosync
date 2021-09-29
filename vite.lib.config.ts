import typescript from "@rollup/plugin-typescript";
import reactRefresh from "@vitejs/plugin-react-refresh";
import path from "path";
import { defineConfig } from "vite";
import macrosPlugin from "vite-plugin-babel-macros";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh(), macrosPlugin()],
  define: {
    "process.platform": JSON.stringify("win32"),
    "process.env": {},
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "lib/main.ts"),
      name: "useReactQueryAutoSync",
      fileName: (format) => `use-react-query-auto-sync.${format}.js`,
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ["react", "react-query"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          react: "React",
          ["react-query"]: "ReactQuery",
        },
      },
      plugins: [
        typescript({
          declaration: true,
          declarationDir: path.resolve(__dirname, "dist"),
          include: ["./lib/**/*"],
        }),
      ],
    },
  },
});
