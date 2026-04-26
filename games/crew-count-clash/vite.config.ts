import { defineConfig } from "vite";

export default defineConfig({
  base: "/crew-count-clash/",
  build: {
    outDir: "../../crew-count-clash",
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
