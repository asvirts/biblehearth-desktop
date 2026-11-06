// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { offlineStyles } from "../vite.config";

const transform = offlineStyles.transform as (
  code: string,
  id: string,
) => { code: string } | undefined;
const sdkStylesheet = "node_modules/@youversion/platform-react-ui/dist/styles.css";

describe("remote fonts", () => {
  it("strips the SDK stylesheet's Google Fonts @import at build time without breaking the CSS", () => {
    const source = readFileSync(sdkStylesheet, "utf8");
    expect(source).toContain("fonts.googleapis.com");
    const result = transform(source, sdkStylesheet)!.code;
    expect(result).not.toMatch(/https?:\/\/fonts\./);
    expect(result).toMatch(/yv-sdk-bible-reader;@layer yv-sdk-styles\{/);
  });

  it("strips the same @import from CSS the SDK injects through JavaScript strings", () => {
    const code = `const css='@layer a;@import "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" layer(f);@layer b{}';`;
    expect(transform(code, "/node_modules/.vite/deps/chunk-X.js")!.code).toBe(
      "const css='@layer a;@layer b{}';",
    );
  });

  it("leaves local @imports alone", () => {
    expect(transform('@import "@fontsource-variable/geist/wght.css";', "a.css")).toBeUndefined();
  });

  it("lets the CSP load fonts only from the app and YouVersion, the one documented exception", () => {
    // The SDK adds <link href="https://api.youversion.com/v1/fonts/...">, so YouVersion stays allowed.
    const csp: string = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8")).app.security.csp;
    const fontSrc = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("font-src"));
    expect(fontSrc).toBe("font-src 'self' data: https://*.youversion.com https://*.bible.com");
  });
});
