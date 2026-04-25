import { defineConfig } from "vite";

export default defineConfig({
  base: "/pancake-stack-run/",
  build: {
    outDir: "../../pancake-stack-run",
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
