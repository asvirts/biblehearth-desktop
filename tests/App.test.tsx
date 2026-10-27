vi.mock("../src/locales", () => ({ translations: {} }));
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Annotation, AppState } from "../src/types";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  location: vi.fn(),
  preferences: vi.fn(),
  flush: vi.fn(),
  native: false,
  invoke: vi.fn(),
  listen: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => mocks.native, invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event",()=>({listen:mocks.listen}));
vi.mock("@tauri-apps/api/window",()=>({getCurrentWindow:()=>({onCloseRequested:mocks.close,destroy:mocks.destroy})}));
vi.mock("../src/storage", () => ({
  storage: {
    load: mocks.load,
    save: mocks.save,
    location: mocks.location,
    preferences: mocks.preferences,
  },
  defaultState: () => ({
    preferences: {
      locale: "en",
      theme: "system",
      fontSize: 20,
      lineHeight: 1.8,
      fontFamily: "serif",
      crashReports: false,
    },
    location: null,
    annotations: [],
    highlightColors: [],
  }),
  flushStorage: mocks.flush,
}));
vi.mock("../src/diagnostics", () => ({
  configureDiagnostics: vi.fn().mockResolvedValue(undefined),
  reportingConfigured: false,
}));
vi.mock("../src/updates", () => ({
  checkUpdate: vi.fn(),
  updatesConfigured: false,
  releasePage: vi.fn(),
  restartApp: vi.fn(),
}));
vi.mock("../src/platform", () => ({
  PlatformProvider: ({ children }: { children: React.ReactNode }) => children,
  PlatformReader: () => <div>Reader mock</div>,
  VersionChooser: () => <div>Version chooser</div>,
  Votd: () => null,
}));
import App from "../src/App";
const note: Annotation = {
  id: "note-1",
  kind: "note",
  versionId: 111,
  book: "JHN",
  chapter: 1,
  verses: [1],
  reference: "John 1:1",
  text: "Original",
  color: "",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
let initial: AppState;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.native=false;
  mocks.listen.mockResolvedValue(()=>{});
  mocks.close.mockResolvedValue(()=>{});
  mocks.invoke.mockResolvedValue(undefined);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi
      .fn()
      .mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
  });
  initial = {
    preferences: {
      locale: "en",
      theme: "system",
      fontSize: 20,
      lineHeight: 1.8,
      fontFamily: "serif",
      crashReports: false,
    },
    location: { versionId: 111, book: "JHN", chapter: 1 },
    annotations: [{ ...note }],
    highlightColors: ["#B9A0E6", "#F0907A", "#7CC3B2", "#F0C063"],
  };
  mocks.load.mockResolvedValue(initial);
  mocks.location.mockImplementation(async (location) => ({
    ...initial,
    location,
  }));
  mocks.flush.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("note persistence", () => {
  it("drains keystrokes entered during a write before closing the editor", async () => {
    let resolveFirst!: (state: AppState) => void;
    mocks.save
      .mockImplementationOnce(
        () =>
          new Promise<AppState>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementation(async (item) => ({
        ...initial,
        annotations: [item],
      }));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Original" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByRole("textbox");
    fireEvent.change(input, { target: { value: "First revision" } });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save", exact: true }),
    );
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: "Latest revision" } });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close", exact: true }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () =>
      resolveFirst({
        ...initial,
        annotations: [{ ...note, text: "First revision" }],
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.save.mock.calls.map(([a]) => a.text)).toEqual([
      "First revision",
      "Latest revision",
    ]);
    expect(
      screen.getByRole("button", { name: "Latest revision" }),
    ).toBeInTheDocument();
  });
  it("keeps unsaved note open on failure and retries the same text", async () => {
    mocks.save
      .mockRejectedValueOnce(new Error("disk full"))
      .mockImplementation(async (item) => ({
        ...initial,
        annotations: [item],
      }));
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Original" }));
    fireEvent.change(await screen.findByRole("textbox"), {
      target: { value: "Do not lose" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Close",
        exact: true,
      }),
    );
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox")).toHaveValue("Do not lose");
    fireEvent.click(
      await within(screen.getByRole("dialog")).findByRole("button", {
        name: "Try again",
        exact: true,
      }),
    );
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[1][0].text).toBe("Do not lose");
  });
  it("reopens the saved version without passing annotation fields into strict native location input", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "John 1:1" }));
    await waitFor(() =>
      expect(mocks.location).toHaveBeenCalledWith({
        versionId: 111,
        book: "JHN",
        chapter: 1,
      }),
    );
  });
  it("Escape dismisses only the top dialog without discarding the note", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Original" }));
    await screen.findByRole("dialog", { name: "Note" });
    fireEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Note" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Remove saved item" })).not.toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("application quit waits for note persistence and refuses exit on flush failure", async () => {
    mocks.native=true;
    let resolveSave!:(state:AppState)=>void;
    mocks.save.mockImplementationOnce(()=>new Promise<AppState>(resolve=>{resolveSave=resolve}));
    render(<App />);
    fireEvent.click(await screen.findByRole("button",{name:"Original"}));
    fireEvent.change(await screen.findByRole("textbox"),{target:{value:"Last words before quit"}});
    const requestQuit=mocks.listen.mock.calls.find(([event])=>event==="biblehearth-exit-requested")![1];
    act(()=>requestQuit({}));
    await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.invoke).not.toHaveBeenCalled();
    mocks.flush.mockRejectedValueOnce(new Error("disk unavailable"));
    await act(async()=>resolveSave({...initial,annotations:[{...note,text:"Last words before quit"}]}));
    await waitFor(()=>expect(mocks.flush).toHaveBeenCalled());
    expect(mocks.invoke).not.toHaveBeenCalled();
    mocks.flush.mockResolvedValue(undefined);
    act(()=>requestQuit({}));
    await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith("finish_exit"));
  });

});
