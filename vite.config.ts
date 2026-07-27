import { cloudflare } from "@cloudflare/vite-plugin";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/.wrangler/**"],
    },
  },
  plugins: [vue(), cloudflare()],
});
