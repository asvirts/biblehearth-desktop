import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Component,
  type ReactNode,
} from "react";
import {
  BookOpen,
  House,
  Library,
  Settings,
  Flame,
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  Highlighter,
  PenLine,
  Search,
  Sun,
  Moon,
  Monitor,
  Globe,
  Shield,
  Download,
  Upload,
  RefreshCw,
  X,
  Menu,
  Trash2,
  Check,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Update } from "@tauri-apps/plugin-updater";
import {
  PlatformProvider,
  PlatformReader,
  VersionChooser,
  Votd,
} from "./platform";
import { storage, defaultState, flushStorage } from "./storage";
import { translator, localeNames, type Translator } from "./i18n";
import { configureDiagnostics, reportingConfigured } from "./diagnostics";
import {
  checkUpdate,
  updatesConfigured,
  releasePage,
  restartApp,
} from "./updates";
import type {
  Annotation,
  AppState,
  Locale,
  ReaderLocation,
  Route,
  Selection,
} from "./types";

const colors = ["#B9A0E6", "#F0907A", "#7CC3B2", "#F0C063"];
const colorKeys = ["violet", "coral", "teal", "amber"];
function Brand() {
  return (
    <div className="brand">
      <svg
        className="brand-mark"
        viewBox="0 0 64 64"
        width="38"
        height="38"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="64" height="64" rx="14" fill="#F7F1E8" />
        <rect x="13" y="10" width="38" height="44" rx="6" fill="#2C2416" />
        <path
          fill="#F7F1E8"
          d="M21.5 48V27c0-7 4.4-11.5 10.5-11.5S42.5 20 42.5 27v21H21.5z"
        />
        <path
          fill="#B54A2C"
          d="M24 38.5c0-6.5 5.2-10.2 8-16.5 2.8 6.3 8 10 8 16.5a8 8 0 1 1-16 0z"
        />
        <path
          fill="#E8B45A"
          d="M28.2 39.2c0-3.6 2.6-5.6 3.8-9 1.2 3.4 3.8 5.4 3.8 9a3.8 3.8 0 1 1-7.6 0z"
        />
      </svg>
      <span>
        Bible<span className="brand-light">Hearth</span>
      </span>
    </div>
  );
}
class Boundary extends Component<
  { children: ReactNode; t: Translator },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="empty">
        <h2>{this.props.t("errorTitle")}</h2>
        <p>{this.props.t("errorBody")}</p>
        <button
          className="primary"
          onClick={() => this.setState({ error: false })}
        >
          {this.props.t("restore")}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [route, setRoute] = useState<Route>("home");
  const [mobileNav, setMobileNav] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [clear, setClear] = useState(0);
  const [editor, setEditor] = useState<Annotation | null>(null);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedText = useRef("");
  const saving = useRef<Promise<boolean> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [chooser, setChooser] = useState(false);
  const [reference, setReference] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Annotation | null>(null);
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [deb, setDeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const t = translator(state.preferences.locale);
  const tRef = useRef(t);
  tRef.current = t;
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const result = await storage.load();
      setState(result);
      setLoaded(true);
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = state.preferences.locale;
    document.documentElement.dir =
      state.preferences.locale === "ar" ? "rtl" : "ltr";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        state.preferences.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : state.preferences.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state.preferences.locale, state.preferences.theme]);
  useEffect(() => {
    if (loaded)
      void configureDiagnostics(state.preferences.crashReports).catch(() => {});
  }, [loaded, state.preferences.crashReports]);
  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(handle);
  }, [toast]);
  const commitEditor = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (saving.current) return saving.current;
    const drain = async () => {
      try {
        while (
          editorRef.current &&
          editorRef.current.text !== savedText.current
        ) {
          const current = editorRef.current;
          setSaveStatus("saving");
          const updatedAt = new Date(
            Math.max(Date.now(), Date.parse(current.updatedAt) + 1),
          ).toISOString();
          const next = await storage.save({ ...current, updatedAt });
          setState(next);
          stateRef.current = next;
          savedText.current = current.text;
          if (editorRef.current?.id === current.id) {
            editorRef.current = { ...editorRef.current, updatedAt };
            setEditor((previous) =>
              previous?.id === current.id
                ? { ...previous, updatedAt }
                : previous,
            );
          }
          // Keystrokes arriving during SQLite writes must also persist before navigation resolves.
        }
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }
        setSaveStatus("saved");
        return true;
      } catch {
        setSaveStatus("error");
        return false;
      }
    };
    const pending = drain();
    saving.current = pending;
    void pending.finally(() => {
      if (saving.current === pending) saving.current = null;
    });
    return pending;
  }, []);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let ending = false;
    const subscriptions: (() => void)[] = [];
    const remember = (unlisten: () => void) => {
      if (disposed) unlisten();
      else subscriptions.push(unlisten);
    };
    const finish = async (quit: boolean) => {
      if (ending) return;
      ending = true;
      try {
        if (await commitEditor()) {
          await flushStorage();
          if (quit) await invoke("finish_exit");
          else await getCurrentWindow().destroy();
        }
      } catch {
        setToast(tRef.current("cannotLeave"));
      } finally {
        ending = false;
      }
    };
    void getCurrentWindow()
      .onCloseRequested((event) => {
        event.preventDefault();
        void finish(false);
      })
      .then(remember)
      .catch(() => setToast(tRef.current("cannotLeave")));
    void listen("biblehearth-exit-requested", () => {
      void finish(true);
    })
      .then(remember)
      .catch(() => setToast(tRef.current("cannotLeave")));
    return () => {
      disposed = true;
      subscriptions.forEach((unlisten) => unlisten());
    };
  }, [commitEditor]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (editorRef.current && editorRef.current.text !== savedText.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, []);
  async function navigate(next: Route) {
    if (!(await commitEditor())) {
      setToast(t("cannotLeave"));
      return;
    }
    editorRef.current = null;
    setEditor(null);
    setRoute(next);
    setMobileNav(false);
    setSelection(null);
  }
  async function locate(location: ReaderLocation) {
    if (!(await commitEditor())) return;
    try {
      setState(
        await storage.location({
          versionId: location.versionId,
          book: location.book,
          chapter: location.chapter,
        }),
      );
      setRoute("reader");
      setReference((current) =>
        stateRef.current.location &&
        stateRef.current.location.book === location.book &&
        stateRef.current.location.chapter === location.chapter
          ? current
          : "",
      );
      setChooser(false);
      setSelection(null);
      setClear((x) => x + 1);
    } catch {
      setToast(t("saveError"));
    }
  }
  async function changePreferences(patch: Partial<AppState["preferences"]>) {
    try {
      setState(await storage.preferences(patch));
    } catch {
      setToast(t("saveError"));
    }
  }
  async function annotate(kind: Annotation["kind"], color = "") {
    if (!selection) return;
    if (!(await commitEditor())) return;
    const now = new Date().toISOString();
    const existing =
      kind !== "note"
        ? state.annotations.find(
            (a) =>
              a.kind === kind &&
              a.versionId === selection.versionId &&
              a.book === selection.book &&
              a.chapter === selection.chapter &&
              a.verses.join(",") === selection.verses.join(","),
          )
        : undefined;
    const item: Annotation = {
      ...selection,
      id: existing?.id ?? crypto.randomUUID(),
      kind,
      text: "",
      color,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing
        ? new Date(
            Math.max(Date.now(), Date.parse(existing.updatedAt) + 1),
          ).toISOString()
        : now,
    };
    if (kind === "note") {
      savedText.current = "";
      editorRef.current = item;
      setEditor(item);
      setSaveStatus("saved");
    } else
      try {
        setState(await storage.save(item));
        setToast(t("saved"));
      } catch {
        setToast(t("saveError"));
      }
  }
  function editText(text: string) {
    if (!editorRef.current) return;
    const next = { ...editorRef.current, text };
    editorRef.current = next;
    setEditor(next);
    setSaveStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void commitEditor(), 600);
  }
  async function editNote(item: Annotation) {
    if (!(await commitEditor())) return;
    savedText.current = item.text;
    editorRef.current = item;
    setEditor(item);
    setSaveStatus("saved");
  }
  async function backup(action: "export" | "import") {
    if (!isTauri()) {
      setToast(t("nativeOnly"));
      return;
    }
    if (!(await commitEditor())) return;
    setBusy(true);
    try {
      if (action === "export") {
        if (await storage.export()) setToast(t("exportComplete"));
      } else {
        const result = await storage.import();
        if (result) {
          setState(await storage.load());
          setToast(
            `${t("importComplete")}: ${t("inserted")} ${result.inserted} · ${t("updated")} ${result.updated} · ${t("preserved")} ${result.preserved} · ${t("skipped")} ${result.skipped}`,
          );
        }
      }
    } catch {
      setToast(t("backupError"));
    } finally {
      setBusy(false);
    }
  }
  const checkForUpdates = useCallback(async (manual = true) => {
    if (!updatesConfigured || !isTauri()) {
      if (manual) setUpdateStatus("updateUnavailable");
      return;
    }
    setUpdateStatus("checking");
    try {
      const result = await checkUpdate();
      setUpdate(result.update);
      setDeb(result.deb);
      setUpdateStatus(
        result.deb
          ? "downloadPackage"
          : result.update
            ? "updateAvailable"
            : manual
              ? "upToDate"
              : "",
      );
    } catch {
      setUpdateStatus(manual ? "updateError" : "");
    }
  }, []);
  useEffect(() => {
    if (loaded) void checkForUpdates(false);
  }, [loaded, checkForUpdates]);
  async function installUpdate() {
    if (!update || !(await commitEditor())) return;
    setBusy(true);
    setProgress(0);
    try {
      await flushStorage();
      let total = 0,
        received = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          setProgress(
            total ? Math.min(100, Math.round((received / total) * 100)) : 0,
          );
        }
      });
      setUpdateStatus("updateReady");
      setUpdate(null);
    } catch {
      setUpdateStatus("updateError");
    } finally {
      setBusy(false);
    }
  }
  async function restartSafely() {
    try {
      if (!(await commitEditor())) return;
      await flushStorage();
      await restartApp();
    } catch {
      setToast(t("cannotLeave"));
    }
  }
  const closeEditor = async () => {
    if (await commitEditor()) {
      editorRef.current = null;
      setEditor(null);
    }
  };
  useEffect(() => {
    const esc = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (deleteTarget) {
        setDeleteTarget(null);
        return;
      }
      if (chooser) {
        setChooser(false);
        return;
      }
      if (editorRef.current) {
        void commitEditor().then((ok) => {
          if (ok) {
            editorRef.current = null;
            setEditor(null);
          }
        });
        return;
      }
      if (mobileNav) {
        setMobileNav(false);
        return;
      }
      setSelection(null);
      setClear((x) => x + 1);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [commitEditor, deleteTarget, chooser, mobileNav]);
  const highlighted = state.annotations
    .filter((a) => a.kind === "highlight")
    .flatMap((a) =>
      a.verses.map((v) => ({
        version_id: a.versionId,
        passage_id: `${a.book}.${a.chapter}.${v}`,
        color: a.color,
      })),
    );
  const recent = [...state.annotations].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const visible = recent.filter(
    (a) =>
      (filter === "all" || a.kind === filter) &&
      `${a.reference} ${a.text}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const placeLabel = state.location
    ? reference || `${state.location.book} ${state.location.chapter}`
    : "";
  const navigation = [
    { id: "home" as const, icon: House },
    { id: "reader" as const, icon: BookOpen },
    { id: "library" as const, icon: Library },
    { id: "settings" as const, icon: Settings },
  ];
  function savedCard(a: Annotation) {
    const Icon =
      a.kind === "note"
        ? PenLine
        : a.kind === "highlight"
          ? Highlighter
          : Bookmark;
    return (
      <article className={`saved-card ${a.kind}`} key={a.id}>
        <div className="saved-card-top">
          <span
            className="saved-icon"
            style={a.color ? { color: a.color } : undefined}
          >
            <Icon size={18} />
          </span>
          <span>{t(a.kind)}</span>
          <button
            className="icon-button delete-button"
            aria-label={t("delete")}
            onClick={() => setDeleteTarget(a)}
          >
            <Trash2 size={16} />
          </button>
        </div>
        <button className="passage-link" onClick={() => void locate(a)}>
          {a.reference}
          <ArrowUpRight size={17} />
        </button>
        <span className="version-label">
          {t("version")} {a.versionId}
        </span>
        {a.kind === "note" && (
          <button className="note-preview" onClick={() => void editNote(a)}>
            {a.text || t("notePlaceholder")}
          </button>
        )}
        <div className="saved-date">
          {new Intl.DateTimeFormat(state.preferences.locale, {
            month: "short",
            day: "numeric",
          }).format(new Date(a.updatedAt))}
          {a.kind === "note" && (
            <button
              className="icon-button"
              onClick={() => void editNote(a)}
              aria-label={t("note")}
            >
              <PenLine size={15} />
            </button>
          )}
        </div>
      </article>
    );
  }
  if (loadError)
    return (
      <main className="fatal">
        <Brand />
        <h1>{t("errorTitle")}</h1>
        <p>{t("saveError")}</p>
        <button className="primary" onClick={() => void load()}>
          {t("retry")}
        </button>
      </main>
    );
  if (!loaded)
    return (
      <main className="fatal">
        <Brand />
        <p role="status">{t("loading")}</p>
      </main>
    );
  return (
    <PlatformProvider
      locale={state.preferences.locale}
      theme={state.preferences.theme}
    >
      <Boundary t={t}>
        <div className="app-shell">
          <a className="skip-link" href="#main">
            {t("skipContent")}
          </a>
          <aside className={`sidebar ${mobileNav ? "visible" : ""}`}>
            <Brand />
            <button
              className="mobile-close icon-button"
              onClick={() => setMobileNav(false)}
              aria-label={t("close")}
            >
              <X />
            </button>
            <nav aria-label="BibleHearth">
              {navigation.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  aria-current={route === id ? "page" : undefined}
                  className={route === id ? "nav-item active" : "nav-item"}
                  onClick={() => void navigate(id)}
                >
                  <Icon size={20} />
                  <span>{t(id)}</span>
                  {route === id && <span className="active-dot" />}
                </button>
              ))}
            </nav>
            <div className="sidebar-art">
              <div className="little-flame">
                <Flame size={30} />
              </div>
              <p>{t("tagline")}</p>
              <span className="art-orbit" />
            </div>
            <div className="sidebar-footer">
              <Shield size={14} />
              <span>{t("localOnly")}</span>
            </div>
            <small className="app-version">
              BibleHearth · {__APP_VERSION__}
            </small>
          </aside>
          <div className="main-shell">
            <header className="topbar">
              <button
                className="mobile-menu icon-button"
                onClick={() => setMobileNav(true)}
                aria-label={t("openNavigation")}
              >
                <Menu />
              </button>
              <div className="topbar-actions">
                {!online && (
                  <span className="offline-badge">
                    <WifiOff size={14} />
                    {t("offline")}
                  </span>
                )}
                <button
                  className="icon-button"
                  aria-label={t("theme")}
                  onClick={() =>
                    void changePreferences({
                      theme:
                        document.documentElement.dataset.theme === "dark"
                          ? "light"
                          : "dark",
                    })
                  }
                >
                  {document.documentElement.dataset.theme === "dark" ? (
                    <Moon size={19} />
                  ) : (
                    <Sun size={19} />
                  )}
                </button>
                <button
                  className="language-pill"
                  onClick={() => void navigate("settings")}
                >
                  <Globe size={15} />
                  {state.preferences.locale.toUpperCase()}
                </button>
              </div>
            </header>
            {!isTauri() && <div className="preview-banner">{t("preview")}</div>}
            <main
              id="main"
              className={`main-content ${route === "reader" ? "reader-content" : ""}`}
              tabIndex={-1}
            >
              {route === "home" && (
                <>
                  <div className="page-heading">
                    <span className="eyebrow">
                      <span className="tiny-dot" /> BIBLEHEARTH
                    </span>
                    <h1>{t("welcome")}</h1>
                    <p>{t("welcomeBody")}</p>
                  </div>
                  <div className="dashboard-grid">
                    <section className="hero-card">
                      <div className="hero-copy">
                        <span className="eyebrow">{t("yourReading")}</span>
                        <h2>{state.location ? placeLabel : t("setupTitle")}</h2>
                        <p>
                          {state.location ? t("readerHint") : t("setupBody")}
                        </p>
                        <button
                          className="hero-button"
                          onClick={() => void navigate("reader")}
                        >
                          {t(
                            state.location ? "continueReading" : "startReading",
                          )}
                          <ArrowRight size={19} />
                        </button>
                      </div>
                      <div className="hero-art" aria-hidden="true">
                        <div className="hero-glow" />
                        <div className="hero-ring" />
                        <div className="hero-ring two" />
                        <div className="hero-book">
                          <BookOpen size={120} strokeWidth={0.9} />
                        </div>
                      </div>
                    </section>
                    <section className="daily-card">
                      {!state.location && (
                        <span className="daily-label">
                          <Sparkles size={17} />
                          {t("dailyVerse")}
                        </span>
                      )}
                      {state.location ? (
                        <Votd
                          versionId={state.location.versionId}
                          onNavigate={(l) => void locate(l)}
                          t={t}
                          theme={state.preferences.theme}
                        />
                      ) : (
                        <>
                          <div className="daily-art">
                            <Sun size={44} strokeWidth={1.2} />
                          </div>
                          <p>{t("chooseVersionBody")}</p>
                          <button
                            className="text-button"
                            onClick={() => void navigate("reader")}
                          >
                            {t("chooseVersion")}
                            <ArrowUpRight size={18} />
                          </button>
                        </>
                      )}
                    </section>
                  </div>
                  <div className="section-heading">
                    <div>
                      <h2>{t("recent")}</h2>
                      <p>{t("recentBody")}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => void navigate("library")}
                    >
                      {t("viewAll")}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  {recent.length ? (
                    <div className="cards-grid">
                      {recent.slice(0, 3).map(savedCard)}
                    </div>
                  ) : (
                    <div className="empty-library">
                      <span className="empty-icon">
                        <Bookmark size={24} />
                      </span>
                      <div>
                        <h3>{t("emptyLibrary")}</h3>
                        <p>{t("emptyLibraryBody")}</p>
                      </div>
                      <ArrowUpRight className="empty-arrow" size={22} />
                    </div>
                  )}
                  <div className="home-bottom">
                    <span>
                      <Shield size={15} />
                      {t("localOnly")}
                    </span>
                    <span>✦</span>
                    <span>{t("tagline")}</span>
                  </div>
                </>
              )}
              {route === "reader" && (
                <>
                  <div className="reader-heading">
                    <div>
                      <span className="eyebrow">{t("reader")}</span>
                      <h1>
                        {state.location ? placeLabel : t("chooseVersion")}
                      </h1>
                    </div>
                    {state.location && (
                      <button
                        className="secondary"
                        onClick={() => setChooser(true)}
                      >
                        {t("chooseVersion")}
                      </button>
                    )}
                  </div>
                  {state.location ? (
                    <>
                      <p className="reader-tip">{t("readerHint")}</p>
                      <PlatformReader
                        location={state.location}
                        locale={state.preferences.locale}
                        highlights={highlighted}
                        onLocationChange={(l) => void locate(l)}
                        onReference={setReference}
                        onSelection={(s) =>
                          setSelection(s.verses.length ? s : null)
                        }
                        fontSize={state.preferences.fontSize}
                        lineHeight={state.preferences.lineHeight}
                        fontFamily={state.preferences.fontFamily}
                        theme={state.preferences.theme}
                        onReadingSettingsChange={(patch) =>
                          void changePreferences(patch)
                        }
                        clearSelectionSignal={clear}
                        t={t}
                      />
                    </>
                  ) : (
                    <div className="onboarding-card">
                      <span className="onboarding-icon">
                        <BookOpen size={34} />
                      </span>
                      <p>{t("chooseVersionBody")}</p>
                      <VersionChooser
                        locale={state.preferences.locale}
                        onChoose={(versionId) =>
                          void locate({ versionId, book: "JHN", chapter: 1 })
                        }
                        t={t}
                      />
                    </div>
                  )}
                </>
              )}
              {route === "library" && (
                <>
                  <div className="page-heading">
                    <span className="eyebrow">{t("localOnly")}</span>
                    <h1>{t("library")}</h1>
                    <p>{t("recentBody")}</p>
                  </div>
                  <div className="library-toolbar">
                    <div className="filter-tabs" aria-label={t("filter")}>
                      {["all", "note", "bookmark", "highlight"].map((f) => (
                        <button
                          key={f}
                          className={filter === f ? "selected" : ""}
                          onClick={() => setFilter(f)}
                        >
                          {t(
                            f === "note"
                              ? "notes"
                              : f === "bookmark"
                                ? "bookmarks"
                                : f === "highlight"
                                  ? "highlights"
                                  : f,
                          )}
                        </button>
                      ))}
                    </div>
                    <label className="search-field">
                      <Search size={17} />
                      <input
                        aria-label={t("searchLibrary")}
                        placeholder={t("searchLibrary")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  {visible.length ? (
                    <div className="cards-grid">{visible.map(savedCard)}</div>
                  ) : (
                    <div className="empty">
                      <Library size={40} strokeWidth={1.2} />
                      <h2>{t(query ? "noResults" : "emptyLibrary")}</h2>
                      <p>{t("emptyLibraryBody")}</p>
                      <button
                        className="primary"
                        onClick={() => void navigate("reader")}
                      >
                        {t("startReading")}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  )}
                </>
              )}
              {route === "settings" && (
                <>
                  <div className="page-heading">
                    <span className="eyebrow">BIBLEHEARTH</span>
                    <h1>{t("settings")}</h1>
                    <p>{t("appearanceBody")}</p>
                  </div>
                  <div className="settings-grid">
                    <section className="settings-card">
                      <h2>
                        <Sun size={20} />
                        {t("appearance")}
                      </h2>
                      <label className="field-label">{t("theme")}</label>
                      <div className="theme-options">
                        {[
                          { key: "light" as const, Icon: Sun },
                          { key: "dark" as const, Icon: Moon },
                          { key: "system" as const, Icon: Monitor },
                        ].map(({ key, Icon }) => (
                          <button
                            key={key}
                            aria-pressed={state.preferences.theme === key}
                            className={
                              state.preferences.theme === key ? "selected" : ""
                            }
                            onClick={() =>
                              void changePreferences({ theme: key })
                            }
                          >
                            <Icon size={21} />
                            {t(key)}
                          </button>
                        ))}
                      </div>
                      <label className="range-label">
                        {t("fontSize")}
                        <span>{state.preferences.fontSize}px</span>
                        <input
                          type="range"
                          min="12"
                          max="20"
                          step="1"
                          value={state.preferences.fontSize}
                          onChange={(e) =>
                            void changePreferences({
                              fontSize: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="range-label">
                        {t("lineHeight")}
                        <span>{state.preferences.lineHeight}</span>
                        <input
                          type="range"
                          min="1.2"
                          max="2.5"
                          step="0.1"
                          value={state.preferences.lineHeight}
                          onChange={(e) =>
                            void changePreferences({
                              lineHeight: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="field-label">
                        {t("fontFamily")}
                        <select
                          value={state.preferences.fontFamily}
                          onChange={(e) =>
                            void changePreferences({
                              fontFamily: e.target.value,
                            })
                          }
                        >
                          <option value="serif">{t("serif")}</option>
                          <option value="sans-serif">{t("sans")}</option>
                        </select>
                      </label>
                      <label className="field-label">
                        {t("language")}
                        <select
                          value={state.preferences.locale}
                          onChange={(e) =>
                            void changePreferences({
                              locale: e.target.value as Locale,
                            })
                          }
                        >
                          {Object.entries(localeNames).map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </section>
                    <div className="settings-stack">
                      <section className="settings-card">
                        <h2>
                          <Shield size={20} />
                          {t("privacy")}
                        </h2>
                        <p>{t("privacyBody")}</p>
                        <label className="toggle-row">
                          <span>{t("crashReports")}</span>
                          <input
                            type="checkbox"
                            checked={
                              state.preferences.crashReports &&
                              reportingConfigured
                            }
                            disabled={!reportingConfigured}
                            onChange={(e) =>
                              void changePreferences({
                                crashReports: e.target.checked,
                              })
                            }
                          />
                        </label>
                        <p className="small">{t("crashReportsBody")}</p>
                        {!reportingConfigured && (
                          <p className="muted-note">{t("sentryUnavailable")}</p>
                        )}
                      </section>
                      <section className="settings-card">
                        <h2>
                          <Download size={20} />
                          {t("backups")}
                        </h2>
                        <p>{t("backupsBody")}</p>
                        <div className="button-row">
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => void backup("export")}
                          >
                            <Download size={16} />
                            {t("exportBackup")}
                          </button>
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => void backup("import")}
                          >
                            <Upload size={16} />
                            {t("importBackup")}
                          </button>
                        </div>
                      </section>
                      <section className="settings-card">
                        <h2>
                          <RefreshCw size={20} />
                          {t("updates")}
                        </h2>
                        <button
                          className="secondary"
                          disabled={busy || updateStatus === "checking"}
                          onClick={() => void checkForUpdates()}
                        >
                          {t("checkUpdates")}
                        </button>
                        {updateStatus && (
                          <p role="status">
                            {t(updateStatus)}
                            {update && ` ${update.version}`}
                          </p>
                        )}
                        {update && (
                          <>
                            <p className="small">{t("confirmUpdate")}</p>
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() => void installUpdate()}
                            >
                              {t("installUpdate")}
                              {busy && ` ${progress}%`}
                            </button>
                          </>
                        )}
                        {deb && (
                          <button
                            className="secondary"
                            onClick={() =>
                              void releasePage().catch(() =>
                                setUpdateStatus("updateError"),
                              )
                            }
                          >
                            {t("downloadPackage")}
                          </button>
                        )}
                        {updateStatus === "updateReady" && (
                          <button
                            className="primary"
                            onClick={() => void restartSafely()}
                          >
                            {t("restart")}
                          </button>
                        )}
                      </section>
                    </div>
                    <section className="settings-card about-card">
                      <Brand />
                      <p>{t("aboutBody")}</p>
                      <span>
                        {t("version")} {__APP_VERSION__} · MIT
                      </span>
                    </section>
                  </div>
                </>
              )}
            </main>
          </div>
          {selection && route === "reader" && !editor && (
            <div className="selection-bar">
              <strong>{selection.reference}</strong>
              <div className="selection-actions">
                <button onClick={() => void annotate("note")}>
                  <PenLine size={18} />
                  {t("addNote")}
                </button>
                <button onClick={() => void annotate("bookmark")}>
                  <Bookmark size={18} />
                  {t("addBookmark")}
                </button>
                <div className="color-options" aria-label={t("selectedColor")}>
                  {colors.map((color, i) => (
                    <button
                      key={color}
                      className="color-dot"
                      style={{ background: color }}
                      aria-label={`${t("addHighlight")} · ${t(colorKeys[i])}`}
                      onClick={() => void annotate("highlight", color)}
                    />
                  ))}
                </div>
                <button
                  className="icon-button"
                  aria-label={t("clearSelection")}
                  onClick={() => {
                    setSelection(null);
                    setClear((x) => x + 1);
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}
          {editor && (
            <Modal label={t("note")} onClose={() => void closeEditor()}>
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">{t("note")}</span>
                  <h2>{editor.reference}</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={() => void closeEditor()}
                  aria-label={t("close")}
                >
                  <X />
                </button>
              </div>
              <span className="version-label">
                {t("version")} {editor.versionId}
              </span>
              <textarea
                className="note-editor"
                autoFocus
                aria-label={t("note")}
                placeholder={t("notePlaceholder")}
                value={editor.text}
                onChange={(e) => editText(e.target.value)}
              />
              <div className="editor-footer">
                <span
                  role="status"
                  className={saveStatus === "error" ? "error-text" : ""}
                >
                  {saveStatus === "saved" ? <Check size={15} /> : null}
                  {t(
                    saveStatus === "saved"
                      ? "saved"
                      : saveStatus === "saving"
                        ? "saving"
                        : "saveError",
                  )}
                </span>
                <button className="primary" onClick={() => void commitEditor()}>
                  {t(saveStatus === "error" ? "retry" : "save")}
                </button>
              </div>
            </Modal>
          )}
          {chooser && (
            <Modal label={t("chooseVersion")} onClose={() => setChooser(false)}>
              <div className="modal-heading">
                <h2>{t("chooseVersion")}</h2>
                <button
                  className="icon-button"
                  aria-label={t("close")}
                  onClick={() => setChooser(false)}
                >
                  <X />
                </button>
              </div>
              <VersionChooser
                locale={state.preferences.locale}
                onChoose={(versionId) =>
                  void locate({ ...state.location!, versionId })
                }
                t={t}
              />
            </Modal>
          )}
          {deleteTarget && (
            <Modal
              label={t("deleteTitle")}
              onClose={() => setDeleteTarget(null)}
            >
              <h2>{t("deleteTitle")}</h2>
              <p>{t("deleteConfirm")}</p>
              <div className="button-row">
                <button
                  className="secondary"
                  onClick={() => setDeleteTarget(null)}
                >
                  {t("cancel")}
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    void storage
                      .delete(deleteTarget.id)
                      .then((next) => {
                        setState(next);
                        setDeleteTarget(null);
                      })
                      .catch(() => setToast(t("saveError")));
                  }}
                >
                  {t("delete")}
                </button>
              </div>
            </Modal>
          )}
          {toast && (
            <div className="toast" role="status">
              <Check size={17} />
              {toast}
              <button
                className="icon-button"
                onClick={() => setToast("")}
                aria-label={t("close")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {update && route !== "settings" && (
            <button
              className="update-toast"
              onClick={() => void navigate("settings")}
            >
              <Download size={16} />
              {t("updateAvailable")}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </Boundary>
    </PlatformProvider>
  );
}
function Modal({
  children,
  label,
  onClose,
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button,input,textarea,select,[tabindex="0"]',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusable();
      const first = list[0],
        last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    const node = ref.current;
    node?.addEventListener("keydown", trap);
    return () => {
      node?.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
