import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

// Stylesheets must not import fonts from a CDN. The YouVersion SDK's runtime font
// stylesheet is the one documented exception (design.md, Type).
// The YouVersion SDK imports Inter and Source Serif from Google Fonts, both in its
// stylesheet and in the CSS string its JavaScript injects. Strip every remote @import.
const remoteImport = /@import\s+(?:url\(\s*)?(["'])https?:\/\/.*?\1\s*\)?[^;]*;/g;
export const offlineStyles: Plugin = {
  name: "biblehearth-offline-styles",
  enforce: "pre",
  transform(code, id) {
    if (!/\.(css|m?js)($|\?)/.test(id) || !code.includes("@import")) return;
    const local = code.replace(remoteImport, "");
    if (local !== code) return { code: local, map: null };
  },
};
export default defineConfig({
  plugins: [offlineStyles, react()],
  define: { __APP_VERSION__: JSON.stringify("0.1.0") },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_"],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
