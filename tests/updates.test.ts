import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  invoke: vi.fn(),
  check: vi.fn(),
  openUrl: vi.fn(),
  relaunch: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: mocks.isTauri,
  invoke: mocks.invoke,
}));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: mocks.openUrl }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_UPDATES_ENABLED", "true");
  mocks.isTauri.mockReturnValue(true);
  mocks.invoke.mockResolvedValue("native");
  mocks.check.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());
it("does not check updates in development or browser preview", async () => {
  vi.stubEnv("VITE_UPDATES_ENABLED", "false");
  let u = await import("../src/updates");
  await expect(u.checkUpdate()).rejects.toThrow("updateUnavailable");
  expect(mocks.check).not.toHaveBeenCalled();
  vi.resetModules();
  vi.stubEnv("VITE_UPDATES_ENABLED", "true");
  mocks.isTauri.mockReturnValue(false);
  u = await import("../src/updates");
  await expect(u.checkUpdate()).rejects.toThrow("updateUnavailable");
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it("Debian installations never invoke AppImage updater", async () => {
  mocks.invoke.mockResolvedValue("deb");
  const u = await import("../src/updates");
  await expect(u.checkUpdate()).resolves.toEqual({ update: null, deb: true });
  expect(mocks.check).not.toHaveBeenCalled();
});
it("rejects unknown installation types", async () => {
  mocks.invoke.mockResolvedValue("unknown");
  const u = await import("../src/updates");
  await expect(u.checkUpdate()).rejects.toThrow("updateUnavailable");
  expect(mocks.check).not.toHaveBeenCalled();
});
it("checks a signed-updater candidate without downloading or installing it", async () => {
  const candidate = { version: "0.2.0", downloadAndInstall: vi.fn() };
  mocks.check.mockResolvedValue(candidate);
  const u = await import("../src/updates");
  await expect(u.checkUpdate()).resolves.toEqual({
    update: candidate,
    deb: false,
  });
  expect(candidate.downloadAndInstall).not.toHaveBeenCalled();
});
it("propagates network failures for UI retry", async () => {
  mocks.check.mockRejectedValueOnce(new Error("network"));
  const u = await import("../src/updates");
  await expect(u.checkUpdate()).rejects.toThrow("network");
});
it("opens only the fixed repository release URL", async () => {
  const u = await import("../src/updates");
  await u.releasePage();
  expect(mocks.openUrl).toHaveBeenCalledWith(
    "https://github.com/asvirts/biblehearth-desktop/releases/latest",
  );
});
