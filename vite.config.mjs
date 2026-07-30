import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL("./public", import.meta.url)),
  publicDir: false,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000"
    }
  },
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        availableStorage: fileURLToPath(
          new URL(
            "./public/availableStorage.html",
            import.meta.url
          )
        ),
        dashboard: fileURLToPath(
          new URL("./public/dashboard.html", import.meta.url)
        ),
        login: fileURLToPath(
          new URL("./public/login.html", import.meta.url)
        ),
        main: fileURLToPath(new URL("./public/index.html", import.meta.url)),
        manageFiles: fileURLToPath(
          new URL("./public/manageFiles.html", import.meta.url)
        )
      }
    }
  }
});
