import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Component,
  type ReactNode,
} from "react";
import {
  IconContext,
  ArrowRight,
  ArrowUpRight,
  BookmarkSimple,
  Books,
  Check,
  Desktop,
  DownloadSimple,
  GearSix,
  HighlighterCircle,
  List,
  MagnifyingGlass,
  Moon,
  PencilSimpleLine,
  ShieldCheck,
  Sun,
  Trash,
  UploadSimple,
  WifiSlash,
  X,
  type Icon,
  type IconProps,
} from "@phosphor-icons/react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Update } from "@tauri-apps/plugin-updater";
import {
  PassageName,
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

const colorKeys = ["violet", "coral", "teal", "amber"];
const iconDefaults: IconProps = {
  size: 18,
  weight: "light",
  "aria-hidden": true,
  focusable: "false",
};
const primaryNavigation: Route[] = ["home", "reader", "library"];
const kindIcon: Record<Annotation["kind"], Icon> = {
  note: PencilSimpleLine,
  highlight: HighlighterCircle,
  bookmark: BookmarkSimple,
};
const filters = [
  { id: "all", label: "all" },
  { id: "note", label: "notes" },
  { id: "bookmark", label: "bookmarks" },
  { id: "highlight", label: "highlights" },
] as const;
const themes = [
  { key: "light", Icon: Sun },
  { key: "dark", Icon: Moon },
  { key: "system", Icon: Desktop },
] as const;
function Brand({ vertical = false }: { vertical?: boolean }) {
  return (
    <div className={vertical ? "brand brand-vertical" : "brand"}>
      <svg
        className="brand-mark"
        viewBox="0 0 64 64"
        width="28"
        height="28"
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
      <span className="brand-word">BibleHearth</span>
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
      <div className="empty-state">
        <h2>{this.props.t("errorTitle")}</h2>
        <p>{this.props.t("errorBody")}</p>
        <button
          className="button primary"
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
    if (kind === "note") {
      const now = new Date().toISOString();
      const item: Annotation = {
        ...selection,
        id: crypto.randomUUID(),
        kind,
        text: "",
        color,
        createdAt: now,
        updatedAt: now,
      };
      savedText.current = "";
      editorRef.current = item;
      setEditor(item);
      setSaveStatus("saved");
      return;
    }
    try {
      setState(await storage.mark({ ...selection, kind, color }));
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
    ? reference || (
        <PassageName
          location={state.location}
          fallback={`${state.location.book} ${state.location.chapter}`}
        />
      )
    : "";
  const theme =
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const dateFormat = new Intl.DateTimeFormat(state.preferences.locale, {
    month: "short",
    day: "numeric",
  });
  function savedCard(a: Annotation) {
    const KindIcon = kindIcon[a.kind];
    return (
      <article className="card saved-card" key={a.id}>
        <div className="saved-card-meta">
          <span className="label">
            {a.kind === "highlight" && a.color ? (
              <span className="swatch" style={{ background: a.color }} />
            ) : (
              <KindIcon size={14} />
            )}
            {t(a.kind)}
          </span>
          <button
            className="icon-button quiet"
            aria-label={t("delete")}
            title={t("delete")}
            onClick={() => setDeleteTarget(a)}
          >
            <Trash size={16} />
          </button>
        </div>
        <button className="passage-link" onClick={() => void locate(a)}>
          {a.reference}
          <ArrowUpRight size={16} className="directional" />
        </button>
        <span className="version-label">
          {t("version")} {a.versionId}
        </span>
        {a.kind === "note" && (
          <button className="note-preview" onClick={() => void editNote(a)}>
            {a.text || t("notePlaceholder")}
          </button>
        )}
        <div className="saved-card-foot">
          <time dateTime={a.updatedAt}>
            {dateFormat.format(new Date(a.updatedAt))}
          </time>
          {a.kind === "note" && (
            <button
              className="icon-button quiet"
              onClick={() => void editNote(a)}
              aria-label={t("note")}
              title={t("note")}
            >
              <PencilSimpleLine size={14} />
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
        <button className="button primary" onClick={() => void load()}>
          {t("retry")}
        </button>
      </main>
    );
  if (!loaded)
    return (
      <main className="fatal">
        <Brand />
        <p role="status" className="label">
          {t("loading")}
        </p>
      </main>
    );
  return (
    <PlatformProvider
      locale={state.preferences.locale}
      theme={state.preferences.theme}
    >
      <IconContext.Provider value={iconDefaults}>
        <Boundary t={t}>
          <div className="app-shell">
            <a className="skip-link" href="#main">
              {t("skipContent")}
            </a>
            <aside className={`rail ${mobileNav ? "visible" : ""}`}>
              <Brand vertical />
              <button
                className="drawer-close icon-button"
                onClick={() => setMobileNav(false)}
                aria-label={t("close")}
              >
                <X size={20} />
              </button>
              <div className="rail-tools">
                <button
                  className="rail-button"
                  aria-label={t("theme")}
                  title={t("theme")}
                  onClick={() =>
                    void changePreferences({
                      theme: theme === "dark" ? "light" : "dark",
                    })
                  }
                >
                  {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                  <span className="rail-label" aria-hidden="true">
                    {t("theme")}
                  </span>
                </button>
                <button
                  className="rail-button"
                  title={t("language")}
                  onClick={() => void navigate("settings")}
                >
                  <span className="language-code">
                    {state.preferences.locale.toUpperCase()}
                  </span>
                  <span className="rail-label" aria-hidden="true">
                    {localeNames[state.preferences.locale]}
                  </span>
                </button>
                <button
                  className="rail-button"
                  aria-current={route === "settings" ? "page" : undefined}
                  title={t("settings")}
                  onClick={() => void navigate("settings")}
                >
                  <GearSix size={20} />
                  <span className="rail-label">{t("settings")}</span>
                </button>
              </div>
              <div className="rail-footer">
                <span>
                  <ShieldCheck size={14} />
                  {t("localOnly")}
                </span>
                <small>BibleHearth · {__APP_VERSION__}</small>
              </div>
            </aside>
            <div className="main-shell">
              <header className="topbar">
                <button
                  className="menu-button icon-button"
                  onClick={() => setMobileNav(true)}
                  aria-label={t("openNavigation")}
                >
                  <List size={20} />
                </button>
                {!online && (
                  <span className="offline-badge">
                    <WifiSlash size={14} />
                    {t("offline")}
                  </span>
                )}
                <nav className="primary-nav" aria-label="BibleHearth">
                  {primaryNavigation.map((id) => (
                    <button
                      key={id}
                      aria-current={route === id ? "page" : undefined}
                      className="nav-item"
                      onClick={() => void navigate(id)}
                    >
                      {t(id)}
                    </button>
                  ))}
                </nav>
              </header>
              {!isTauri() && (
                <div className="preview-banner">{t("preview")}</div>
              )}
              <main
                id="main"
                className={`main-content ${route === "reader" ? "reader-content" : ""}`}
                tabIndex={-1}
              >
                {route === "home" && (
                  <>
                    <header className="page-heading">
                      <h1>{t("welcome")}</h1>
                      <p>{t("welcomeBody")}</p>
                    </header>
                    <div className="home-grid">
                      <section className="card continue-card">
                        <span className="label">{t("yourReading")}</span>
                        <h2>
                          {state.location ? placeLabel : t("setupTitle")}
                        </h2>
                        <p>
                          {state.location ? t("readerHint") : t("setupBody")}
                        </p>
                        <button
                          className="button primary"
                          onClick={() => void navigate("reader")}
                        >
                          {t(
                            state.location
                              ? "continueReading"
                              : "startReading",
                          )}
                          <ArrowRight size={16} className="directional" />
                        </button>
                      </section>
                      <section className="card daily-card">
                        <span className="label">
                          <Sun size={14} />
                          {t("dailyVerse")}
                        </span>
                        {state.location ? (
                          <Votd
                            versionId={state.location.versionId}
                            onNavigate={(l) => void locate(l)}
                            t={t}
                            theme={state.preferences.theme}
                          />
                        ) : (
                          <>
                            <p>{t("chooseVersionBody")}</p>
                            <button
                              className="text-button"
                              onClick={() => void navigate("reader")}
                            >
                              {t("chooseVersion")}
                              <ArrowUpRight size={14} className="directional" />
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
                        <ArrowRight size={14} className="directional" />
                      </button>
                    </div>
                    {recent.length ? (
                      <div className="cards-grid">
                        {recent.slice(0, 3).map(savedCard)}
                      </div>
                    ) : (
                      <div className="card empty-card">
                        <h3 className="label accent">
                          {t("emptyLibrary")}
                        </h3>
                        <p>{t("emptyLibraryBody")}</p>
                      </div>
                    )}
                    <footer className="home-footer">
                      <span>
                        <ShieldCheck size={14} />
                        {t("localOnly")}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t("tagline")}</span>
                    </footer>
                  </>
                )}
                {route === "reader" && (
                  <>
                    <header className="page-heading reader-heading">
                      <div>
                        <span className="label">{t("reader")}</span>
                        <h1>
                          {state.location ? placeLabel : t("chooseVersion")}
                        </h1>
                      </div>
                      {state.location && (
                        <button
                          className="button secondary"
                          onClick={() => setChooser(true)}
                        >
                          {t("chooseVersion")}
                        </button>
                      )}
                    </header>
                    {state.location ? (
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
                    ) : (
                      <section className="card onboarding-card">
                        <p>{t("chooseVersionBody")}</p>
                        <VersionChooser
                          locale={state.preferences.locale}
                          onChoose={(versionId) =>
                            void locate({ versionId, book: "JHN", chapter: 1 })
                          }
                          t={t}
                        />
                      </section>
                    )}
                  </>
                )}
                {route === "library" && (
                  <>
                    <header className="page-heading">
                      <span className="label">{t("localOnly")}</span>
                      <h1>{t("library")}</h1>
                      <p>{t("recentBody")}</p>
                    </header>
                    <div className="library-toolbar">
                      <label className="search-field">
                        <MagnifyingGlass size={20} />
                        <input
                          aria-label={t("searchLibrary")}
                          placeholder={t("searchLibrary")}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <div
                        className="chips"
                        role="group"
                        aria-label={t("filter")}
                      >
                        {filters.map((f) => (
                          <button
                            key={f.id}
                            className="chip"
                            aria-pressed={filter === f.id}
                            onClick={() => setFilter(f.id)}
                          >
                            {t(f.label)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {visible.length ? (
                      <div className="cards-grid">{visible.map(savedCard)}</div>
                    ) : (
                      <div className="empty-state">
                        <Books size={32} />
                        <h2>{t(query ? "noResults" : "emptyLibrary")}</h2>
                        <p>{t("emptyLibraryBody")}</p>
                        <button
                          className="button primary"
                          onClick={() => void navigate("reader")}
                        >
                          {t("startReading")}
                          <ArrowRight size={16} className="directional" />
                        </button>
                      </div>
                    )}
                  </>
                )}
                {route === "settings" && (
                  <>
                    <header className="page-heading">
                      <h1>{t("settings")}</h1>
                      <p>{t("appearanceBody")}</p>
                    </header>
                    <div className="settings-column">
                      <section className="card settings-card">
                        <h2>{t("appearance")}</h2>
                        <div className="setting">
                          <span className="field-label" id="theme-label">
                            {t("theme")}
                          </span>
                          <div
                            className="segmented"
                            role="group"
                            aria-labelledby="theme-label"
                          >
                            {themes.map(({ key, Icon: ThemeIcon }) => (
                              <button
                                key={key}
                                aria-pressed={state.preferences.theme === key}
                                onClick={() =>
                                  void changePreferences({ theme: key })
                                }
                              >
                                <ThemeIcon size={16} />
                                {t(key)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="setting range-setting">
                          <span className="field-label">{t("fontSize")}</span>
                          <output>{state.preferences.fontSize}px</output>
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
                        <label className="setting range-setting">
                          <span className="field-label">
                            {t("lineHeight")}
                          </span>
                          <output>{state.preferences.lineHeight}</output>
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
                        <label className="setting">
                          <span className="field-label">
                            {t("fontFamily")}
                          </span>
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
                        <label className="setting">
                          <span className="field-label">{t("language")}</span>
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
                      <section className="card settings-card">
                        <h2>{t("privacy")}</h2>
                        <p>{t("privacyBody")}</p>
                        <label className="toggle-row">
                          <span>{t("crashReports")}</span>
                          <input
                            type="checkbox"
                            className="switch"
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
                          <p className="small">
                            {t("sentryUnavailable")}
                          </p>
                        )}
                      </section>
                      <section className="card settings-card">
                        <h2>{t("backups")}</h2>
                        <p>{t("backupsBody")}</p>
                        <div className="button-row">
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => void backup("export")}
                          >
                            <DownloadSimple size={16} />
                            {t("exportBackup")}
                          </button>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => void backup("import")}
                          >
                            <UploadSimple size={16} />
                            {t("importBackup")}
                          </button>
                        </div>
                      </section>
                      <section className="card settings-card">
                        <h2>{t("updates")}</h2>
                        <div className="button-row">
                          <button
                            className="button secondary"
                            disabled={busy || updateStatus === "checking"}
                            onClick={() => void checkForUpdates()}
                          >
                            {t("checkUpdates")}
                          </button>
                        </div>
                        {updateStatus && (
                          <p role="status">
                            {t(updateStatus)}
                            {update && ` ${update.version}`}
                          </p>
                        )}
                        {update && (
                          <>
                            <p className="small">{t("confirmUpdate")}</p>
                            <div className="button-row">
                              <button
                                className="button primary"
                                disabled={busy}
                                onClick={() => void installUpdate()}
                              >
                                {t("installUpdate")}
                                {busy && ` ${progress}%`}
                              </button>
                            </div>
                          </>
                        )}
                        {deb && (
                          <div className="button-row">
                            <button
                              className="button secondary"
                              onClick={() =>
                                void releasePage().catch(() =>
                                  setUpdateStatus("updateError"),
                                )
                              }
                            >
                              {t("downloadPackage")}
                            </button>
                          </div>
                        )}
                        {updateStatus === "updateReady" && (
                          <div className="button-row">
                            <button
                              className="button primary"
                              onClick={() => void restartSafely()}
                            >
                              {t("restart")}
                            </button>
                          </div>
                        )}
                      </section>
                      <section className="card settings-card about-card">
                        <h2 className="visually-hidden">{t("about")}</h2>
                        <Brand />
                        <p>{t("aboutBody")}</p>
                        <span className="label">
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
                  <button
                    className="pill-action"
                    onClick={() => void annotate("note")}
                  >
                    <PencilSimpleLine size={16} />
                    {t("addNote")}
                  </button>
                  <button
                    className="pill-action"
                    onClick={() => void annotate("bookmark")}
                  >
                    <BookmarkSimple size={16} />
                    {t("addBookmark")}
                  </button>
                  <div
                    className="color-options"
                    role="group"
                    aria-label={t("selectedColor")}
                  >
                    {state.highlightColors.map((color, i) => (
                      <button
                        key={color}
                        className="color-dot"
                        style={{ background: color }}
                        aria-label={`${t("addHighlight")} · ${t(colorKeys[i])}`}
                        title={t(colorKeys[i])}
                        onClick={() => void annotate("highlight", color)}
                      />
                    ))}
                  </div>
                  <button
                    className="icon-button"
                    aria-label={t("clearSelection")}
                    title={t("clearSelection")}
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
              <Modal
                label={t("note")}
                onClose={() => void closeEditor()}
                size="wide"
              >
                <div className="modal-heading">
                  <div>
                    <span className="label accent">{t("note")}</span>
                    <h2>{editor.reference}</h2>
                    <span className="version-label">
                      {t("version")} {editor.versionId}
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => void closeEditor()}
                    aria-label={t("close")}
                  >
                    <X size={20} />
                  </button>
                </div>
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
                    className={
                      saveStatus === "error"
                        ? "save-status error-text"
                        : "save-status"
                    }
                  >
                    {saveStatus === "saved" ? <Check size={14} /> : null}
                    {t(
                      saveStatus === "saved"
                        ? "saved"
                        : saveStatus === "saving"
                          ? "saving"
                          : "saveError",
                    )}
                  </span>
                  <button
                    className="button primary"
                    onClick={() => void commitEditor()}
                  >
                    {t(saveStatus === "error" ? "retry" : "save")}
                  </button>
                </div>
              </Modal>
            )}
            {chooser && (
              <Modal
                label={t("chooseVersion")}
                onClose={() => setChooser(false)}
              >
                <div className="modal-heading">
                  <h2>{t("chooseVersion")}</h2>
                  <button
                    className="icon-button"
                    aria-label={t("close")}
                    onClick={() => setChooser(false)}
                  >
                    <X size={20} />
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
                size="narrow"
              >
                <div className="confirm">
                  <h2>{t("deleteTitle")}</h2>
                  <p>{t("deleteConfirm")}</p>
                  <div className="button-row">
                    <button
                      className="button ghost"
                      onClick={() => setDeleteTarget(null)}
                    >
                      {t("cancel")}
                    </button>
                    <button
                      className="button danger"
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
                </div>
              </Modal>
            )}
            {toast && (
              <div className="toast" role="status">
                <Check size={16} />
                <span>{toast}</span>
                <button
                  className="icon-button"
                  onClick={() => setToast("")}
                  aria-label={t("close")}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {update && route !== "settings" && (
              <button
                className="update-toast"
                onClick={() => void navigate("settings")}
              >
                <DownloadSimple size={16} />
                {t("updateAvailable")}
                <ArrowRight size={14} className="directional" />
              </button>
            )}
          </div>
        </Boundary>
      </IconContext.Provider>
    </PlatformProvider>
  );
}
function Modal({
  children,
  label,
  onClose,
  size = "regular",
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  size?: "narrow" | "regular" | "wide";
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
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
