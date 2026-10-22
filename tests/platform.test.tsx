import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  root: {} as Record<string, any>,
  provider: {} as Record<string, any>,
  versionsOptions: {} as Record<string, any>,
  language: "",
  error: null as Error | null,
  refetch: vi.fn(),
}));
vi.mock("@youversion/platform-react-ui", () => ({
  YouVersionProvider: (props: Record<string, any>) => {
    sdk.provider = props;
    return props.children;
  },
  BibleReader: {
    Root: (props: Record<string, any>) => {
      sdk.root = props;
      return props.children;
    },
    Toolbar: () => <div>SDK search and navigation</div>,
    Content: () => <div>SDK passage</div>,
  },
  VerseOfTheDay: () => <div>SDK daily verse</div>,
  getHttpStatus: (error: { status?: number }) => error?.status,
}));
vi.mock("@youversion/platform-react-hooks", () => ({
  usePassage: () => ({ error: sdk.error, refetch: sdk.refetch }),
  useVerses: () => ({ loading: false, verses: { data: [{id:"1",title:"1",passage_id:"JHN.1.1"}] } }),
  useVersions: (_language: string, _license: unknown, options: object) => {
    sdk.versionsOptions = options; sdk.language = _language;
    return {
      versions: {
        data: [
          {
            id: 42,
            title: "Licensed Bible",
            localized_title: "Licensed Bible",
            abbreviation: "LB",
            language_tag: "en",
          },
        ],
      },
      loading: false,
      error: null,
    };
  },
  useVerseOfTheDay: () => ({
    data: { passage_id: "JHN.3.16" },
    loading: false,
    error: null,
  }),
}));
let PlatformReader: typeof import("../src/platform").PlatformReader;
let PlatformProvider: typeof import("../src/platform").PlatformProvider;
let VersionChooser: typeof import("../src/platform").VersionChooser;
let Votd: typeof import("../src/platform").Votd;
const t = (key: string) => key;
const defaults = {
  location: { versionId: 42, book: "JHN", chapter: 1 },
  locale: "en",
  highlights: [],
  onLocationChange: vi.fn(),
  onSelection: vi.fn(),
  fontSize: 18,
  lineHeight: 1.7,
  fontFamily: "serif",
  t,
  theme: "light" as const,
};
beforeEach(async () => {
  vi.stubEnv("VITE_YVP_APP_KEY", "test-public-key");
  vi.resetModules();
  sdk.error = null;
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", {
    value: true,
    configurable: true,
  });
  ({ PlatformReader, PlatformProvider, VersionChooser, Votd } =
    await import("../src/platform"));
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
describe("Platform boundary", () => {
  it("disables authentication and controls highlights from the first mount", () => {
    render(
      <PlatformProvider locale="ar">
        <PlatformReader {...defaults} />
      </PlatformProvider>,
    );
    expect(sdk.provider.includeAuth).toBe(false);
    expect(sdk.provider.locale).toBe("ar");
    expect(sdk.root.highlights).toEqual([]);
    expect(sdk.root.verseActions).toBe("none");
    expect(screen.getByText("SDK search and navigation")).toBeInTheDocument();
  });
  it("forwards selection as UI state without carrying Scripture text", () => {
    render(<PlatformReader {...defaults} />);
    act(() =>
      sdk.root.onVerseSelect({
        versionId: 42,
        book: "JHN",
        chapter: "1",
        verses: [2, 2, -1],
        reference: "John 1:2",
        shareData: { text: "not persisted" },
      }),
    );
    expect(defaults.onSelection).toHaveBeenCalledWith({
      versionId: 42,
      book: "JHN",
      chapter: 1,
      verses: [2],
      reference: "John 1:2",
    });
    expect(defaults.onLocationChange).not.toHaveBeenCalled();
  });
  it("preserves both fields when SDK changes book and chapter in the same turn", () => {
    render(<PlatformReader {...defaults} />);
    act(() => {
      sdk.root.onBookChange("PSA");
      sdk.root.onChapterChange("23");
    });
    expect(defaults.onLocationChange).toHaveBeenLastCalledWith({
      versionId: 42,
      book: "PSA",
      chapter: 23,
    });
  });
  it("requests only licensed versions and forwards the actual selected ID", () => {
    const choose = vi.fn();
    render(<VersionChooser locale="en" onChoose={choose} t={t} />);
    expect(sdk.versionsOptions.all_available).toBe(false);
    expect(sdk.versionsOptions.page_size).toBe(99);
    fireEvent.click(screen.getByText("allLanguages")); expect(sdk.language).toBe("*");
    fireEvent.click(screen.getByText("Licensed Bible"));
    expect(choose).toHaveBeenCalledWith(42);
  });
  it("forwards SDK font changes to persistent host preferences", () => {
    const change=vi.fn(); render(<PlatformReader {...defaults} onReadingSettingsChange={change}/>);
    act(() => {sdk.root.onFontSizeChange(20);sdk.root.onFontFamilyChange("serif");sdk.root.onChangeLineSpacing(2);});
    expect(change.mock.calls).toEqual([[{fontSize:20}],[{fontFamily:"serif"}],[{lineHeight:2}]]);
  });
  it("offers a keyboard-accessible verse selector without persisting selection", () => {
    render(<PlatformReader {...defaults}/>);
    fireEvent.change(screen.getByRole("combobox", {name:"selectedPassage"}), {target:{value:"1"}});
    expect(defaults.onSelection).toHaveBeenCalledWith({versionId:42,book:"JHN",chapter:1,verses:[1],reference:"JHN 1:1"});
    expect(defaults.onLocationChange).not.toHaveBeenCalled();
  });
  it("keeps denied content actionable and retries without exposing raw errors", () => {
    sdk.error = Object.assign(new Error("private request detail"), {
      status: 403,
    });
    render(<PlatformReader {...defaults} />);
    expect(screen.getByRole("alert")).toHaveTextContent("platformDenied");
    expect(
      screen.queryByText("private request detail"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("retry"));
    expect(sdk.refetch).toHaveBeenCalled();
  });
  it("replaces Scripture with offline state without mounting the SDK reader", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    render(<PlatformReader {...defaults} />);
    expect(screen.getByRole("status")).toHaveTextContent("platformOffline");
    expect(screen.queryByText("SDK passage")).not.toBeInTheDocument();
  });
  it("opens the real verse-of-day chapter", () => {
    const navigate = vi.fn();
    render(<Votd versionId={42} onNavigate={navigate} theme="light" t={t} />);
    fireEvent.click(screen.getByText("readChapter"));
    expect(navigate).toHaveBeenCalledWith({
      versionId: 42,
      book: "JHN",
      chapter: 3,
    });
  });
  it("keeps local children available when no Platform key is configured", async () => {
    vi.stubEnv("VITE_YVP_APP_KEY", "");
    vi.resetModules();
    const missing = await import("../src/platform");
    render(
      <missing.PlatformProvider locale="en">
        <p>Local library</p>
        <missing.PlatformReader {...defaults} />
      </missing.PlatformProvider>,
    );
    expect(screen.getByText("Local library")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("platformMissingKey");
  });
});
