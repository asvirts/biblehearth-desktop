import type { Locale } from "./types";
export const localeNames: Record<Locale, string> = {
  en: "English",
  af: "Afrikaans",
  ar: "العربية",
  cs: "Čeština",
  cy: "Cymraeg",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  ko: "한국어",
  no: "Norsk",
  pt: "Português",
  sr: "Српски",
  tr: "Türkçe",
  vi: "Tiếng Việt",
  zh: "中文",
};
export const en = {
  home: "Home",
  reader: "Reader",
  library: "Your library",
  settings: "Settings",
  tagline: "A little space for the Word.",
  welcome: "Make room for what matters.",
  welcomeBody:
    "A moment to pause. A passage to carry with you. Find your place in Scripture.",
  continueReading: "Continue reading",
  startReading: "Open your Bible",
  yourReading: "YOUR NEXT QUIET MOMENT",
  dailyVerse: "Verse of the Day",
  recent: "Close to your heart",
  recentBody: "Your latest notes, highlights, and saved passages.",
  viewAll: "View library",
  emptyLibrary: "A place for what stays with you.",
  emptyLibraryBody:
    "Select a passage while reading to add a note, highlight, or bookmark. Your collection will appear here.",
  notes: "Notes",
  bookmarks: "Bookmarks",
  highlights: "Highlights",
  all: "All",
  note: "Note",
  bookmark: "Bookmark",
  highlight: "Highlight",
  addNote: "Write a note",
  addBookmark: "Save bookmark",
  addHighlight: "Highlight passage",
  selectedPassage: "Selected passage",
  clearSelection: "Clear selection",
  notePlaceholder: "What stands out to you?",
  save: "Save",
  saved: "Saved on this device",
  saving: "Saving…",
  saveError: "Could not save. Your changes remain open. Try again.",
  delete: "Delete",
  deleteConfirm: "Delete this saved item? This cannot be undone.",
  cancel: "Cancel",
  close: "Close",
  searchLibrary: "Search your library",
  noResults: "No matching saved items.",
  appearance: "Make it yours",
  appearanceBody: "A comfortable place to read, your way.",
  theme: "Appearance",
  light: "Light",
  dark: "Dark",
  system: "Match device",
  fontSize: "Text size",
  lineHeight: "Line spacing",
  fontFamily: "Reading font",
  serif: "Book serif",
  sans: "Clean sans",
  language: "App language",
  privacy: "Privacy & diagnostics",
  privacyBody:
    "Your personal library stays on this device. Bible content is requested online from YouVersion Platform.",
  crashReports: "Share anonymous error reports",
  crashReportsBody:
    "Optional reports go to BibleHearth’s personal Sentry project. Notes, Scripture, searches, and credentials are excluded. No session recordings or performance tracking.",
  sentryUnavailable: "Error reporting is not configured for this build.",
  backups: "Keep your library safe",
  backupsBody:
    "Export a portable backup or merge a previous backup without replacing your library.",
  exportBackup: "Export backup",
  importBackup: "Import backup",
  importComplete: "Backup merged",
  exportComplete: "Backup exported",
  backupError:
    "Backup could not be completed. Your library has not been replaced.",
  updates: "App updates",
  checkUpdates: "Check for updates",
  checking: "Checking…",
  upToDate: "You’re up to date.",
  updateAvailable: "An update is available.",
  installUpdate: "Download & install",
  updateError:
    "Could not complete the update. Your library is safe; try again later.",
  updateUnavailable: "Updates are not configured in this build.",
  restart: "Restart to finish",
  updateReady: "Update installed. Restart when you’re ready.",
  downloadPackage: "Download latest package",
  platformMissingKey:
    "Bible content is not connected yet. The app needs its YouVersion Platform configuration before you can choose a Bible.",
  platformOffline:
    "You’re offline. Your personal library is available; reconnect to load Scripture.",
  platformError:
    "Scripture could not be loaded. Check your connection and try again.",
  platformDenied:
    "This Bible is not available to this app. Choose another version.",
  platformUnavailable: "This passage is unavailable in the selected Bible.",
  retry: "Try again",
  loading: "Loading…",
  chooseVersion: "Choose your Bible",
  chooseVersionBody:
    "Find a version in your language. You can change it any time.",
  moreVersions: "Load more versions",
  suggestedVersions: "Suggested for your language",
  allLanguages: "All languages",
  readChapter: "Read chapter",
  localOnly: "Private by design. Saved on your device.",
  preview: "Browser preview · personal data is temporary",
  offline: "Offline · your library is still here",
  about: "About BibleHearth",
  aboutBody:
    "An independent, free, open-source Bible reader. Scripture is provided through YouVersion Platform and remains under its publishers’ terms.",
  version: "Version",
  openNavigation: "Open navigation",
  skipContent: "Skip to content",
  selectedColor: "Highlight color",
  violet: "Violet",
  coral: "Coral",
  teal: "Teal",
  amber: "Amber",
  libraryCount: "Saved passages",
  readerHint: "Select a verse to make it yours.",
  setupTitle: "A home for your time in Scripture.",
  setupBody:
    "Choose a Bible to begin. Your reading place, notes, and highlights will stay right here.",
  errorTitle: "Something interrupted your reading.",
  errorBody:
    "Reload the reader to try again. Your saved library is still on this device.",
  restore: "Reload reader",
  nativeOnly: "Available in the installed desktop app.",
  inserted: "Added",
  updated: "Updated",
  preserved: "Conflicts preserved",
  skipped: "Unchanged",
  deleteTitle: "Remove saved item",
  confirmUpdate:
    "Download this update and install it? Your notes will be saved first.",
  cannotLeave: "Your note could not be saved. Retry saving before leaving.",
  consentUnavailable:
    "Reporting remains off until a personal Sentry project is configured.",
  filter: "Filter",
  recentEmpty: "Your next discovery belongs here.",
  openSaved: "Open passage",
  unsaved: "Unsaved changes",
};
export type TranslationKey = keyof typeof en;
export type Translator = (key: string) => string;
// Locale dictionaries are imported separately so completeness can be tested.
import { translations } from "./locales";
export function detectLocale(): Locale {
  const code =
    typeof navigator === "undefined" ? "en" : navigator.language.split("-")[0];
  return code in localeNames ? (code as Locale) : "en";
}
export function translator(locale: Locale): Translator {
  return (key) =>
    translations[locale]?.[key] ?? en[key as TranslationKey] ?? key;
}
