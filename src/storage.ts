import { invoke, isTauri } from "@tauri-apps/api/core";
import type {
  AppState,
  Preferences,
  ReaderLocation,
  Annotation,
  ImportSummary,
} from "./types";
import { detectLocale } from "./i18n";
export const defaultState = (): AppState => ({
  preferences: {
    locale: detectLocale(),
    theme: "system",
    fontSize: 20,
    lineHeight: 1.8,
    fontFamily: "serif",
    crashReports: false,
  },
  location: null,
  annotations: [],
});
// Browser preview is deliberately ephemeral. Production persistence belongs to SQLite.
let preview: AppState = defaultState();
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation, operation);
  queue = next;
  return next;
}
export const flushStorage = () => queue;
export const storage = {
  load: () =>
    isTauri()
      ? invoke<AppState>("load_state")
      : Promise.resolve(structuredClone(preview)),
  preferences: (patch: Partial<Preferences>) =>
    serial(async () => {
      const current = isTauri()
        ? await invoke<AppState>("load_state")
        : preview;
      const preferences = { ...current.preferences, ...patch };
      if (isTauri())
        return invoke<AppState>("save_preferences", { preferences });
      preview = { ...preview, preferences };
      return structuredClone(preview);
    }),
  location: (location: ReaderLocation) =>
    serial(async () => {
      if (isTauri()) return invoke<AppState>("save_location", { location });
      preview = { ...preview, location };
      return structuredClone(preview);
    }),
  save: (annotation: Annotation) =>
    serial(async () => {
      if (isTauri())
        return invoke<AppState>("upsert_annotation", { annotation });
      preview = {
        ...preview,
        annotations: [
          ...preview.annotations.filter((a) => a.id !== annotation.id),
          annotation,
        ],
      };
      return structuredClone(preview);
    }),
  delete: (id: string) =>
    serial(async () => {
      if (isTauri()) return invoke<AppState>("delete_annotation", { id });
      preview = {
        ...preview,
        annotations: preview.annotations.filter((a) => a.id !== id),
      };
      return structuredClone(preview);
    }),
  export: () => serial(() => invoke<boolean>("export_backup_file")),
  import: () =>
    serial(() => invoke<ImportSummary | null>("import_backup_file")),
};
