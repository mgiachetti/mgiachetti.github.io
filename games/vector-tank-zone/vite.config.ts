import { defineConfig } from "vite";

export default defineConfig({
  base: "/vector-tank-zone/",
  build: {
    outDir: "../../vector-tank-zone",
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
