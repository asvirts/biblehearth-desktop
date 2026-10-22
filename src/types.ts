export type Locale =
  | "en"
  | "af"
  | "ar"
  | "cs"
  | "cy"
  | "de"
  | "es"
  | "fr"
  | "ko"
  | "no"
  | "pt"
  | "sr"
  | "tr"
  | "vi"
  | "zh";
export type Route = "home" | "reader" | "library" | "settings";
export interface ReaderLocation {
  versionId: number;
  book: string;
  chapter: number;
}
export interface Selection extends ReaderLocation {
  verses: number[];
  reference: string;
}
export interface Annotation extends Selection {
  id: string;
  kind: "note" | "bookmark" | "highlight";
  text: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}
export interface Preferences {
  locale: Locale;
  theme: "light" | "dark" | "system";
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  crashReports: boolean;
}
export interface AppState {
  preferences: Preferences;
  location: ReaderLocation | null;
  annotations: Annotation[];
}
export interface ImportSummary {
  inserted: number;
  updated: number;
  preserved: number;
  skipped: number;
}
