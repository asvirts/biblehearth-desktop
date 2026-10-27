vi.mock("../src/locales", () => ({ translations: {} }));
import { beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ enabled: false, invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => native.enabled,
  invoke: native.invoke,
}));
describe("serialized persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    native.enabled = false;
    native.invoke.mockReset();
  });
  it("merges rapid preference patches without reverting independent fields", async () => {
    const { storage } = await import("../src/storage");
    await Promise.all([
      storage.preferences({ theme: "dark" }),
      storage.preferences({ fontSize: 18 }),
      storage.preferences({ locale: "ar" }),
    ]);
    expect((await storage.load()).preferences).toMatchObject({
      theme: "dark",
      fontSize: 18,
      locale: "ar",
    });
  });
  it("recovers the queue after a rejected write and surfaces the current failure at flush", async () => {
    native.enabled = true;
    native.invoke.mockRejectedValueOnce(new Error("disk full"));
    const { storage, flushStorage } = await import("../src/storage");
    await expect(storage.delete("a")).rejects.toThrow("disk full");
    await expect(flushStorage()).rejects.toThrow("disk full");
    native.invoke.mockResolvedValueOnce({ annotations: [] });
    await storage.delete("a");
    await expect(flushStorage()).resolves.toEqual({ annotations: [] });
  });
  it("serializes export after writes and distinguishes canceled native imports", async () => {
    native.enabled = true;
    const { storage } = await import("../src/storage");
    native.invoke
      .mockResolvedValueOnce({ annotations: [] })
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(null);
    await Promise.all([storage.delete("a"), storage.export()]);
    expect(await storage.import()).toBeNull();
    expect(native.invoke.mock.calls.map(([name]) => name)).toEqual([
      "delete_annotation",
      "export_backup_file",
      "import_backup_file",
    ]);
  });
  it("marks a passage by intent, in preview and natively", async () => {
    const intent = {
      kind: "highlight" as const,
      versionId: 111,
      book: "JHN",
      chapter: 1,
      verses: [1],
      reference: "John 1:1",
      color: "#B9A0E6",
    };
    const { storage } = await import("../src/storage");
    await storage.mark(intent);
    const state = await storage.mark({ ...intent, color: "#F0907A" });
    expect(state.annotations).toHaveLength(1);
    expect(state.annotations[0]).toMatchObject({
      kind: "highlight",
      color: "#F0907A",
    });
    expect(state.highlightColors).toContain("#B9A0E6");
    native.enabled = true;
    native.invoke.mockResolvedValueOnce({ annotations: [] });
    await storage.mark(intent);
    expect(native.invoke).toHaveBeenCalledWith("mark_passage", { mark: intent });
  });
});
