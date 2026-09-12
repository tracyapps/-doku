import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const publicPaths = new Set([
  "/",
  "/play/",
  "/how/",
  "/history/",
  "/roadmap/",
  "/privacy/",
  "/terms/",
]);

const cleanRoutes: Plugin = {
  name: "doku-clean-routes",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url) {
        const url = new URL(request.url, "http://localhost");
        const path =
          url.pathname === "/"
            ? "/"
            : `/${url.pathname.split("/").filter(Boolean).join("/")}/`;
        if (publicPaths.has(path)) request.url = `/web.html${url.search}`;
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [cleanRoutes, react()],
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
  build: { outDir: "dist/web", rollupOptions: { input: "web.html" } },
});
