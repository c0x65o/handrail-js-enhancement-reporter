import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", server: "src/server.ts", react: "src/react.tsx" },
  clean: true,
  dts: true,
  external: ["react", "react/jsx-runtime"],
  format: ["esm", "cjs"],
  outDir: "dist",
  platform: "neutral",
  sourcemap: true,
  splitting: false,
  target: "es2022",
  treeshake: true
});
