import { cloudflare } from "@cloudflare/vite-plugin";
import vue from "@vitejs/plugin-vue";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    // Keep Vue and Workers type checking in the explicit vue-tsc/tsc script.
    // Vite+'s TypeScript Go path does not load the Cloudflare test pool globals.
    options: { typeAware: true, typeCheck: false },
  },
  server: {
    watch: {
      ignored: ["**/.wrangler/**"],
    },
  },
  plugins: lazyPlugins(() => [vue(), cloudflare()]),
});
