import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  close: vi.fn().mockResolvedValue(true),
  globalHandlersIntegration: vi.fn(() => ({ name: "global" })),
  invoke: vi.fn().mockResolvedValue(undefined),
  isTauri: vi.fn(() => true),
}));
vi.mock("@sentry/react", () => ({
  init: mocks.init,
  close: mocks.close,
  globalHandlersIntegration: mocks.globalHandlersIntegration,
}));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: mocks.isTauri,
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_SENTRY_DSN", "https://public@personal.ingest.sentry.io/1");
  vi.stubEnv("VITE_SENTRY_ACCOUNT", "personal");
  mocks.close.mockResolvedValue(true);
  mocks.invoke.mockResolvedValue(undefined);
  mocks.isTauri.mockReturnValue(true);
});
afterEach(() => vi.unstubAllEnvs());
describe("diagnostics boundary", () => {
  it("requires explicit consent before initializing either runtime", async () => {
    const d = await import("../src/diagnostics");
    await d.configureDiagnostics(false);
    expect(mocks.init).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenLastCalledWith("set_crash_reporting", {
      enabled: false,
    });
  });
  it("rejects non-personal configuration and omitted DSN", async () => {
    vi.stubEnv("VITE_SENTRY_ACCOUNT", "work");
    let d = await import("../src/diagnostics");
    await d.configureDiagnostics(true);
    expect(d.reportingConfigured).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenLastCalledWith("set_crash_reporting", {
      enabled: false,
    });
    vi.resetModules();
    vi.stubEnv("VITE_SENTRY_ACCOUNT", "personal");
    vi.stubEnv("VITE_SENTRY_DSN", "");
    d = await import("../src/diagnostics");
    expect(d.reportingConfigured).toBe(false);
  });
  it("enables only minimal reporting and closes on withdrawal", async () => {
    const d = await import("../src/diagnostics");
    await d.configureDiagnostics(true);
    await d.configureDiagnostics(true);
    expect(mocks.init).toHaveBeenCalledTimes(1);
    expect(mocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        sendDefaultPii: false,
        defaultIntegrations: false,
        tracesSampleRate: 0,
      }),
    );
    await d.configureDiagnostics(false);
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenLastCalledWith("set_crash_reporting", {
      enabled: false,
    });
  });
  it("removes personal message, stack, request, tags, breadcrumbs and contexts", async () => {
    const d = await import("../src/diagnostics");
    const result = d.sanitizedEvent({
      type: undefined,
      event_id: "event",
      message: "private note",
      exception: {
        values: [
          {
            value: "scripture",
            stacktrace: { frames: [{ filename: "/Users/private/file" }] },
          },
        ],
      },
      request: {
        url: "https://example.com/?key=secret",
        headers: { authorization: "secret" },
      },
      tags: { search: "private" },
      user: { email: "private@example.com" },
      breadcrumbs: [{ message: "private" }],
      contexts: { private: { value: "secret" } },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private|secret|scripture|Users/,
    );
    expect(result.message).toBe("BibleHearth frontend error");
  });
  it("serializes close and re-enable so final consent wins", async () => {
    const d = await import("../src/diagnostics");
    await d.configureDiagnostics(true);
    let finish!: () => void;
    mocks.close.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const withdrawal = d.configureDiagnostics(false);
    await Promise.resolve();
    await Promise.resolve();
    const renewal = d.configureDiagnostics(true);
    finish();
    await Promise.all([withdrawal, renewal]);
    expect(mocks.init).toHaveBeenCalledTimes(2);
    expect(mocks.invoke).toHaveBeenLastCalledWith("set_crash_reporting", {
      enabled: true,
    });
  });
});
