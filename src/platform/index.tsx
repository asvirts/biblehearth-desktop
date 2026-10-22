import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BibleReader,
  VerseOfTheDay,
  YouVersionProvider,
  getHttpStatus,
} from "@youversion/platform-react-ui";
import {
  usePassage,
  useVersions,
  useVerses,
  useVerseOfTheDay,
} from "@youversion/platform-react-hooks";
import "@youversion/platform-react-ui/styles.css";

export type Translator = (key: string) => string;
export type ReaderLocation = {
  versionId: number;
  book: string;
  chapter: number;
};
export type PassageSelection = ReaderLocation & {
  verses: number[];
  reference: string;
};
export type ReaderHighlight = {
  version_id: number;
  passage_id: string;
  color: string;
};
export const platformConfigured = Boolean(
  import.meta.env.VITE_YVP_APP_KEY?.trim(),
);
type Theme = "light" | "dark" | "system";

// A packaged public client key identifies the registered app. It is not a secret.
export function PlatformProvider({
  children,
  locale,
  theme = "system",
}: {
  children: ReactNode;
  locale: string;
  theme?: Theme;
}) {
  if (!platformConfigured) return <>{children}</>;
  return (
    <YouVersionProvider
      appKey={import.meta.env.VITE_YVP_APP_KEY}
      appName="BibleHearth"
      includeAuth={false}
      locale={locale}
      theme={theme}
      timeout={20000}
    >
      {children}
    </YouVersionProvider>
  );
}

export function platformErrorKey(error: unknown): string {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403) return "platformDenied";
  if (status === 404) return "platformUnavailable";
  return "platformError";
}
function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
class ContentBoundary extends Component<
  { children: ReactNode; t: Translator },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div role="alert" className="platform-message">
          <p>{this.props.t("platformError")}</p>
          <button
            onClick={() =>
              this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))
            }
          >
            {this.props.t("retry")}
          </button>
        </div>
      );
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
function ContentGate({ children, t }: { children: ReactNode; t: Translator }) {
  const online = useOnline();
  if (!platformConfigured)
    return (
      <div className="platform-message" role="status">
        {t("platformMissingKey")}
      </div>
    );
  if (!online)
    return (
      <div className="platform-message" role="status">
        {t("platformOffline")}
      </div>
    );
  return <ContentBoundary t={t}>{children}</ContentBoundary>;
}
function RequestError({
  error,
  retry,
  t,
}: {
  error: unknown;
  retry: () => void;
  t: Translator;
}) {
  return (
    <div className="platform-message" role="alert">
      <p>{t(platformErrorKey(error))}</p>
      <button onClick={retry}>{t("retry")}</button>
    </div>
  );
}

export type PlatformReaderProps = {
  location: ReaderLocation;
  locale: string;
  highlights: ReaderHighlight[];
  onLocationChange: (location: ReaderLocation) => void;
  onSelection: (selection: PassageSelection) => void;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  t: Translator;
  theme?: Theme;
  clearSelectionSignal?: number;
  onReference?: (reference: string) => void;
  onReadingSettingsChange?: (patch: {
    fontSize?: number;
    lineHeight?: number;
    fontFamily?: string;
  }) => void;
};
export function PlatformReader(props: PlatformReaderProps) {
  return (
    <ContentGate t={props.t}>
      <Reader {...props} />
    </ContentGate>
  );
}
function Reader(props: PlatformReaderProps) {
  const {
    location,
    onLocationChange,
    onSelection,
    locale,
    highlights,
    fontSize,
    fontFamily,
    lineHeight,
    t,
    clearSelectionSignal,
  } = props;
  // SDK navigation can emit book and chapter in the same turn. Accumulate both
  // before forwarding so the second callback cannot restore the previous book.
  const current = useRef(location);
  current.current = location;
  function navigate(patch: Partial<ReaderLocation>) {
    current.current = { ...current.current, ...patch };
    onLocationChange(current.current);
  }
  const passage = usePassage({
    versionId: location.versionId,
    usfm: `${location.book}.${location.chapter}`,
    format: "html",
  });
  const verseList = useVerses(
    location.versionId,
    location.book,
    location.chapter,
  );
  const [keyboardVerse, setKeyboardVerse] = useState("");
  const onReference = props.onReference;
  const humanReference = passage.passage?.reference ?? "";
  useEffect(() => {
    if (humanReference) onReference?.(humanReference);
  }, [humanReference, onReference]);
  useEffect(
    () => setKeyboardVerse(""),
    [location.versionId, location.book, location.chapter, clearSelectionSignal],
  );
  const dark =
    props.theme === "dark" ||
    (props.theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <section className="platform-reader" aria-label={t("reader")}>
      <label className="keyboard-verse-selector">
        <span>{t("selectedPassage")}</span>
        <select
          aria-label={t("selectedPassage")}
          value={keyboardVerse}
          disabled={verseList.loading || !verseList.verses?.data.length}
          onChange={(event) => {
            const value = event.target.value;
            setKeyboardVerse(value);
            onSelection({
              ...location,
              verses: value ? [Number(value)] : [],
              reference: value
                ? `${passage.passage?.reference || `${location.book} ${location.chapter}`}:${value}`
                : "",
            });
          }}
        >
          <option value="">{t("readerHint")}</option>
          {verseList.verses?.data
            .filter((verse) => /^\d+$/.test(verse.id) && Number(verse.id) > 0)
            .map((verse) => (
              <option key={verse.id} value={verse.id}>
                {verse.title}
              </option>
            ))}
        </select>
      </label>
      <BibleReader.Root
        book={location.book}
        chapter={String(location.chapter)}
        versionId={location.versionId}
        onBookChange={(book) => navigate({ book })}
        onChapterChange={(chapter) => {
          const value = Number(chapter);
          if (Number.isInteger(value) && value > 0)
            navigate({ chapter: value });
        }}
        onVersionChange={(versionId) => navigate({ versionId })}
        defaultLanguageId={locale}
        highlights={highlights ?? []}
        verseActions="none"
        clearSelectionSignal={clearSelectionSignal}
        onVerseSelect={(selection) =>
          onSelection({
            versionId: selection.versionId,
            book: selection.book,
            chapter: Number(selection.chapter),
            verses: [...new Set(selection.verses)]
              .filter((verse) => Number.isInteger(verse) && verse > 0)
              .sort((a, b) => a - b),
            reference: selection.reference,
          })
        }
        fontSize={fontSize}
        fontFamily={fontFamily}
        lineSpacing={lineHeight}
        onFontSizeChange={(fontSize) =>
          props.onReadingSettingsChange?.({ fontSize })
        }
        onFontFamilyChange={(fontFamily) =>
          props.onReadingSettingsChange?.({ fontFamily })
        }
        onChangeLineSpacing={(lineHeight) =>
          props.onReadingSettingsChange?.({ lineHeight })
        }
        background={dark ? "dark" : "light"}
      >
        <BibleReader.Toolbar />
        {passage.error ? (
          <RequestError error={passage.error} retry={passage.refetch} t={t} />
        ) : (
          <BibleReader.Content />
        )}
      </BibleReader.Root>
    </section>
  );
}

export function VersionChooser(props: {
  locale: string;
  onChoose: (versionId: number) => void;
  t: Translator;
}) {
  return (
    <ContentGate t={props.t}>
      <Catalog {...props} />
    </ContentGate>
  );
}
function Catalog({
  locale,
  onChoose,
  t,
}: {
  locale: string;
  onChoose: (versionId: number) => void;
  t: Translator;
}) {
  const [all, setAll] = useState(false);
  const [page, setPage] = useState<string | undefined>();
  // all_available deliberately remains false: only app-licensed content appears.
  const { versions, loading, error, refetch } = useVersions(
    all ? "*" : locale,
    undefined,
    { all_available: false, page_size: 99, page_token: page },
  );
  useEffect(() => {
    setPage(undefined);
  }, [locale]);
  return (
    <div className="version-catalog">
      <div className="catalog-header">
        <h3>{t(all ? "chooseVersion" : "suggestedVersions")}</h3>
        <button
          onClick={() => {
            setAll(!all);
            setPage(undefined);
          }}
        >
          {t(all ? "suggestedVersions" : "allLanguages")}
        </button>
      </div>
      {loading && <p role="status">{t("loading")}</p>}
      {error && <RequestError error={error} retry={refetch} t={t} />}
      {!loading && !error && !versions?.data.length && (
        <p>{t("platformUnavailable")}</p>
      )}
      <div className="version-list">
        {versions?.data.map((version) => (
          <button
            className="version-option"
            key={version.id}
            onClick={() => onChoose(version.id)}
          >
            <strong>{version.localized_title || version.title}</strong>
            <span>
              {version.localized_abbreviation || version.abbreviation} ·{" "}
              {version.language_tag}
            </span>
          </button>
        ))}
      </div>
      {versions?.next_page_token && (
        <button onClick={() => setPage(versions.next_page_token!)}>
          {t("moreVersions")}
        </button>
      )}
    </div>
  );
}

export function Votd(props: {
  versionId: number;
  onNavigate: (location: ReaderLocation) => void;
  t: Translator;
  theme?: Theme;
}) {
  return (
    <ContentGate t={props.t}>
      <DailyVerse {...props} />
    </ContentGate>
  );
}
function DailyVerse({
  versionId,
  onNavigate,
  t,
  theme,
}: {
  versionId: number;
  onNavigate: (location: ReaderLocation) => void;
  t: Translator;
  theme?: Theme;
}) {
  const now = new Date();
  const day = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 0)) /
      86400000,
  );
  const { data, error, loading, refetch } = useVerseOfTheDay(day);
  if (error) return <RequestError error={error} retry={refetch} t={t} />;
  if (loading) return <p role="status">{t("loading")}</p>;
  const parts = data?.passage_id.split(".");
  return (
    <div className="daily-verse">
      <VerseOfTheDay
        versionId={versionId}
        dayOfYear={day}
        highlights={[]}
        showShareButton={false}
        showBibleAppAttribution
        background={theme === "dark" ? "dark" : "light"}
      />
      {parts && (
        <button
          onClick={() =>
            onNavigate({ versionId, book: parts[0], chapter: Number(parts[1]) })
          }
        >
          {t("readChapter")}
        </button>
      )}
    </div>
  );
}
