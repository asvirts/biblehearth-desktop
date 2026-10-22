import { isTauri, invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
export const updatesConfigured = Boolean(
  import.meta.env.VITE_UPDATES_ENABLED === "true",
);
export async function checkUpdate(): Promise<{
  update: Update | null;
  deb: boolean;
}> {
  if (!isTauri() || !updatesConfigured) throw new Error("updateUnavailable");
  const kind = await invoke<string>("installation_kind");
  if (kind === "deb") return { update: null, deb: true };
  if (kind !== "native" && kind !== "appimage")
    throw new Error("updateUnavailable");
  return { update: await check(), deb: false };
}
export const releasePage = () =>
  openUrl("https://github.com/asvirts/biblehearth-desktop/releases/latest");
export const restartApp = () => relaunch();
