import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A standalone playtest build: no production player or local research gallery.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist/testing", rollupOptions: { input: "testing.html" } },
});
