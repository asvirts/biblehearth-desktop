// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designDoc = readFileSync("design.md", "utf8");

const css = readFileSync("src/styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const lightSelector = ":root {";
const darkSelector = ':root[data-theme="dark"] {';

function block(selector: string) {
  const start = css.indexOf(selector);
  expect(start, `${selector} block exists`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("\n}", start) + 2);
}
function declarations(text: string) {
  return Object.fromEntries(
    [...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}
const light = declarations(block(lightSelector));
const dark = { ...light, ...declarations(block(darkSelector)) };

function resolve(tokens: Record<string, string>, name: string): string {
  const value = tokens[name];
  expect(value, `${name} is defined`).toBeDefined();
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  return reference ? resolve(tokens, reference[1]) : value;
}
function luminance(hex: string) {
  expect(hex, "contrast pairs use 6-digit hex primitives").toMatch(/^#[0-9a-f]{6}$/i);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(tokens: Record<string, string>, fg: string, bg: string) {
  const [a, b] = [luminance(resolve(tokens, fg)), luminance(resolve(tokens, bg))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const text = 4.5;
const nonText = 3;
const pairs: [string, string, number][] = [
  ["--color-text", "--color-canvas", text],
  ["--color-text", "--color-surface", text],
  ["--color-text", "--color-surface-sunken", text],
  ["--color-text", "--color-surface-hover", text],
  ["--color-text", "--color-surface-raised", text],
  ["--color-text-muted", "--color-surface-raised", text],
  ["--color-text-muted", "--color-canvas", text],
  ["--color-text-muted", "--color-surface", text],
  ["--color-text-muted", "--color-surface-sunken", text],
  ["--color-accent", "--color-surface", text],
  ["--color-accent", "--color-canvas", text],
  ["--color-on-accent", "--color-accent", text],
  ["--color-on-accent", "--color-accent-hover", text],
  ["--color-danger", "--color-surface", text],
  ["--color-on-danger", "--color-danger", text],
  ["--color-on-inverse", "--color-inverse", text],
  ["--color-text-faint", "--color-canvas", nonText],
  ["--color-text-faint", "--color-surface", nonText],
  ["--color-border-control", "--color-surface", nonText],
  ["--color-border-control", "--color-canvas", nonText],
  ["--color-border-control", "--color-surface-sunken", nonText],
  ["--color-control", "--color-surface", nonText],
  ["--color-control", "--color-canvas", nonText],
  ["--color-focus", "--color-surface", nonText],
  ["--color-focus", "--color-canvas", nonText],
];

const decorative = ["--color-scrim", "--color-swatch-ring", "--color-border", "--color-border-strong", "--color-accent-soft"];

describe("design tokens", () => {
  it("checks every color role for contrast or names it as decorative", () => {
    const roles = Object.keys(light).filter((name) => name.startsWith("--color-"));
    const checked = new Set(pairs.flatMap(([fg, bg]) => [fg, bg]));
    expect(roles.filter((role) => !checked.has(role) && !decorative.includes(role))).toEqual([]);
  });

  for (const [theme, tokens] of [
    ["light", light],
    ["dark", dark],
  ] as const)
    it.each(pairs)(`${theme}: %s on %s meets WCAG AA`, (fg, bg, minimum) => {
      expect(contrast(tokens, fg, bg)).toBeGreaterThanOrEqual(minimum);
    });

  it("keeps literal colors inside the token blocks", () => {
    const outside = css
      .replace(block(lightSelector), "")
      .replace(block(darkSelector), "");
    const literals = outside.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi) ?? [];
    expect(literals).toEqual([]);
  });

  it("loads fonts only from local packages", () => {
    const imports = [...css.matchAll(/@import\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const source of imports) expect(source).toMatch(/^@fontsource/);
  });

  it("documents every semantic token with the values styles.css defines", () => {
    const primitive = /^--(gray|night|ember|rose)-/;
    const darkOverrides = new Set(Object.keys(declarations(block(darkSelector))));
    const documented = new Map(
      [...designDoc.matchAll(/^\|\s*`(--[\w-]+)`\s*\|\s*`([^`]+)`\s*\|(?:\s*`([^`]+)`\s*\|)?/gm)].map(
        (m) => [m[1], m[3] ? [m[2], m[3]] : [m[2]]],
      ),
    );
    const shown = (tokens: Record<string, string>, name: string): string => {
      const value = tokens[name].replace(/\s+/g, " ");
      const reference = value.match(/^var\((--[\w-]+)\)$/);
      return reference && primitive.test(reference[1]) ? shown(tokens, reference[1]) : value;
    };
    const drift = Object.keys(light)
      .filter((name) => !primitive.test(name))
      .flatMap((name) => {
        const doc = documented.get(name);
        if (!doc) return [`${name} has no row in design.md`];
        const themed = darkOverrides.has(name) || doc.length > 1;
        const actual = themed ? [shown(light, name), shown(dark, name)] : [shown(light, name)];
        return doc.join(" | ") === actual.join(" | ")
          ? []
          : [`${name}: design.md says ${doc.join(" | ")}, styles.css has ${actual.join(" | ")}`];
      });
    expect(drift).toEqual([]);
  });
});
