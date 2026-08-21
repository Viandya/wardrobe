import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base нужен только для GitHub Pages, где сайт живёт в подпапке /имя-репозитория/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
});
