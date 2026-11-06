// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  BibleReader,
  VerseOfTheDay,
  YouVersionProvider,
} from "@youversion/platform-react-ui";

const css = readFileSync("src/styles.css", "utf8");
const maskedPaths = [...new Set([...css.matchAll(/path\[d\^="([^"]+)"\]/g)].map((m) => m[1]))];
const hiddenHeading = css.match(/(\.daily-verse > \[data-yv-sdk\][^{]*p:first-child)\s*\{\s*display: none;/)?.[1];

beforeAll(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(cleanup);

function withProvider(children: React.ReactNode) {
  return (
    <YouVersionProvider appKey="test" appName="BibleHearth" includeAuth={false} locale="en">
      {children}
    </YouVersionProvider>
  );
}

describe("CSS overrides of the YouVersion SDK", () => {
  it("finds every masked toolbar glyph and the book and chapter button", async () => {
    expect(maskedPaths).toHaveLength(4);
    const { container } = render(
      withProvider(
        <section className="platform-reader">
          <BibleReader.Root book="JHN" chapter="1" versionId={111} verseActions="none">
            <BibleReader.Toolbar />
          </BibleReader.Root>
        </section>,
      ),
    );
    const referenceButtons = () =>
      [...container.querySelectorAll("button")].filter(
        (button) => [...button.children].map((child) => child.tagName).join() === "BDI,BDI",
      );
    await waitFor(() => expect(referenceButtons()).toHaveLength(1));
    const rendered = [...container.querySelectorAll("svg > path")].map((p) => p.getAttribute("d") ?? "");
    const missing = maskedPaths.filter((prefix) => !rendered.some((d) => d.startsWith(prefix)));
    expect(missing).toEqual([]);
  });

  it("hides exactly the SDK's verse of the day heading", async () => {
    expect(hiddenHeading).toBeDefined();
    const { container } = render(
      withProvider(
        <div className="daily-verse">
          <VerseOfTheDay versionId={111} dayOfYear={1} showSunIcon={false} showShareButton={false} showBibleAppAttribution={false} />
        </div>,
      ),
    );
    await waitFor(() => expect(container.querySelector("[data-yv-sdk]")).not.toBeNull());
    const hidden = container.querySelectorAll(hiddenHeading!);
    expect(hidden).toHaveLength(1);
    expect(hidden[0].textContent).toMatch(/verse of the day/i);
  });
});
