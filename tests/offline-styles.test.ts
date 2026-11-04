// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { offlineStyles } from "../vite.config";

const transform = offlineStyles.transform as (
  code: string,
  id: string,
) => { code: string } | undefined;
const sdkStylesheet = "node_modules/@youversion/platform-react-ui/dist/styles.css";

describe("offline styles", () => {
  it("removes the SDK's Google Fonts import without leaving broken CSS", () => {
    const source = readFileSync(sdkStylesheet, "utf8");
    expect(source).toContain("fonts.googleapis.com");
    const result = transform(source, sdkStylesheet)!.code;
    expect(result).not.toMatch(/https?:\/\/fonts\./);
    expect(result).toMatch(/yv-sdk-bible-reader;@layer yv-sdk-styles\{/);
  });

  it("removes the import from CSS injected through JavaScript strings", () => {
    const code = `const css='@layer a;@import "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" layer(f);@layer b{}';`;
    expect(transform(code, "/node_modules/.vite/deps/chunk-X.js")!.code).toBe(
      "const css='@layer a;@layer b{}';",
    );
  });

  it("leaves local imports alone", () => {
    expect(transform('@import "@fontsource-variable/geist/wght.css";', "a.css")).toBeUndefined();
  });
});
