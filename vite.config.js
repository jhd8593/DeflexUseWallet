import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      stream: "stream-browserify",
      crypto: "crypto-browserify"
    }
  },
  define: {
    global: "globalThis",
    "process.env": {}
  },
  optimizeDeps: {
    include: ["buffer", "process"]
  },
  build: {
    target: "esnext"
  }
});
