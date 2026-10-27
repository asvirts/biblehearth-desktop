use crate::annotations::{self, Annotation};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

pub type Result<T> = std::result::Result<T, String>;
const LOCALES: &[&str] = &[
    "en", "af", "ar", "cs", "cy", "de", "es", "fr", "ko", "no", "pt", "sr", "tr", "vi", "zh",
];
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub locale: String,
    pub theme: String,
    pub font_size: f64,
    pub line_height: f64,
    pub font_family: String,
    pub crash_reports: bool,
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            locale: sys_locale::get_locale()
                .and_then(|s| s.split(['-', '_']).next().map(str::to_lowercase))
                .filter(|s| LOCALES.contains(&s.as_str()))
                .unwrap_or_else(|| "en".into()),
            theme: "system".into(),
            font_size: 20.0,
            line_height: 1.8,
            font_family: "serif".into(),
            crash_reports: false,
        }
    }
}
impl Preferences {
    pub fn validate(&self) -> Result<()> {
        if !LOCALES.contains(&self.locale.as_str())
            || !["light", "dark", "system"].contains(&self.theme.as_str())
            || !(12.0..=20.0).contains(&self.font_size)
            || !(1.0..=3.0).contains(&self.line_height)
            || !["serif", "sans-serif", "system"].contains(&self.font_family.as_str())
        {
            return Err("invalid_preferences".into());
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Location {
    pub version_id: u64,
    pub book: String,
    pub chapter: u32,
}
impl Location {
    pub fn validate(&self) -> Result<()> {
        if self.version_id == 0
            || self.version_id > i64::MAX as u64
            || self.book.len() != 3
            || !self
                .book
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
            || self.chapter == 0
            || self.chapter > 200
        {
            Err("invalid_location".into())
        } else {
            Ok(())
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub preferences: Preferences,
    pub location: Option<Location>,
    pub annotations: Vec<Annotation>,
    pub highlight_colors: Vec<String>,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Backup {
    pub format: String,
    pub schema_version: u32,
    pub exported_at: String,
    pub preferences: Preferences,
    pub location: Option<Location>,
    pub annotations: Vec<Annotation>,
}
#[derive(Debug, Default, Serialize)]
pub struct ImportSummary {
    pub inserted: usize,
    pub updated: usize,
    pub preserved: usize,
    pub skipped: usize,
}
pub(crate) fn err(_: impl std::fmt::Display) -> String {
    sentry::capture_message("BibleHearth native storage error", sentry::Level::Error);
    "storage_error".into()
}
pub fn migrate(c: &mut Connection) -> Result<()> {
    c.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
        .map_err(err)?;
    let version: u32 = c
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(err)?;
    if version > 1 {
        return Err("unsupported_database_version".into());
    }
    if version == 0 {
        let tx = c.transaction().map_err(err)?;
        tx.execute_batch("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS annotations (id TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version=1;").map_err(err)?;
        tx.commit().map_err(err)?;
    }
    Ok(())
}
pub fn load(c: &Connection) -> Result<AppState> {
    let get = |key: &str| -> Result<Option<String>> {
        use rusqlite::OptionalExtension;
        c.query_row("SELECT value FROM settings WHERE key=?1", [key], |r| {
            r.get(0)
        })
        .optional()
        .map_err(err)
    };
    let preferences = get("preferences")?
        .map(|s| serde_json::from_str(&s).map_err(err))
        .transpose()?
        .unwrap_or_default();
    let location = get("location")?
        .map(|s| serde_json::from_str(&s).map_err(err))
        .transpose()?;
    let annotations = annotations::load_all(c)?;
    Ok(AppState {
        preferences,
        location,
        annotations,
        highlight_colors: annotations::HIGHLIGHT_COLORS
            .iter()
            .map(|c| c.to_string())
            .collect(),
    })
}
pub fn setting<T: Serialize>(c: &Connection, key: &str, value: &T) -> Result<()> {
    c.execute("INSERT INTO settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,serde_json::to_string(value).map_err(err)?]).map_err(err)?;
    Ok(())
}
pub fn export(c: &Connection) -> Result<String> {
    let state = load(c)?;
    serde_json::to_string_pretty(&Backup {
        format: "biblehearth".into(),
        schema_version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        preferences: state.preferences,
        location: state.location,
        annotations: state.annotations,
    })
    .map_err(err)
}
pub fn import(c: &mut Connection, json: &str) -> Result<ImportSummary> {
    if json.len() > 25_000_000 {
        return Err("backup_too_large".into());
    }
    let backup: Backup = serde_json::from_str(json).map_err(|_| "invalid_backup")?;
    if backup.format != "biblehearth" || backup.schema_version != 1 {
        return Err("unsupported_backup_version".into());
    }
    chrono::DateTime::parse_from_rfc3339(&backup.exported_at).map_err(|_| "invalid_timestamp")?;
    backup.preferences.validate()?;
    if let Some(l) = &backup.location {
        l.validate()?
    }
    let mut ids = std::collections::HashSet::new();
    if backup.annotations.len() > 100_000 {
        return Err("backup_too_large".into());
    }
    for a in &backup.annotations {
        a.validate()?;
        if !ids.insert(&a.id) {
            return Err("duplicate_annotation_id".into());
        }
    }
    let tx = c.transaction().map_err(err)?;
    let current = load(&tx)?;
    let summary = annotations::merge(&tx, backup.annotations)?;
    // Import never enables diagnostics or changes existing preferences.
    if current.location.is_none() {
        if let Some(l) = backup.location {
            setting(&tx, "location", &l)?;
        }
    }
    tx.commit().map_err(err)?;
    Ok(summary)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn db() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        migrate(&mut c).unwrap();
        c
    }
    fn note() -> Annotation {
        Annotation {
            id: "test-note".into(),
            kind: "note".into(),
            version_id: 111,
            book: "JHN".into(),
            chapter: 1,
            verses: vec![1],
            reference: "John 1:1".into(),
            text: "Original note".into(),
            color: "violet".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }
    }
    #[test]
    fn persistence_and_migration() {
        let mut c = db();
        migrate(&mut c).unwrap();
        annotations::save(&c, &note()).unwrap();
        assert_eq!(load(&c).unwrap().annotations[0], note());
        annotations::delete(&c, "test-note").unwrap();
        assert!(load(&c).unwrap().annotations.is_empty());
    }
    #[test]
    fn conflict_import_is_idempotent() {
        let mut c = db();
        annotations::save(&c, &note()).unwrap();
        let mut b: Backup = serde_json::from_str(&export(&c).unwrap()).unwrap();
        b.annotations[0].text = "Changed".into();
        b.annotations[0].updated_at = "2026-02-01T00:00:00Z".into();
        let json = serde_json::to_string(&b).unwrap();
        let s = import(&mut c, &json).unwrap();
        assert_eq!((s.updated, s.preserved), (1, 1));
        let s = import(&mut c, &json).unwrap();
        assert_eq!((s.updated, s.preserved, s.inserted), (0, 0, 0));
        assert_eq!(load(&c).unwrap().annotations.len(), 2);
    }
    #[test]
    fn invalid_import_is_atomic() {
        let mut c = db();
        let mut b: Backup = serde_json::from_str(&export(&c).unwrap()).unwrap();
        b.annotations = vec![
            note(),
            Annotation {
                id: "second".into(),
                chapter: 0,
                ..note()
            },
        ];
        assert!(import(&mut c, &serde_json::to_string(&b).unwrap()).is_err());
        assert!(load(&c).unwrap().annotations.is_empty());
    }
    #[test]
    fn identity_conflict_rolls_back() {
        let mut c = db();
        annotations::save(&c, &note()).unwrap();
        let mut b: Backup = serde_json::from_str(&export(&c).unwrap()).unwrap();
        b.annotations.insert(
            0,
            Annotation {
                id: "new".into(),
                ..note()
            },
        );
        b.annotations[1].version_id = 1;
        assert!(import(&mut c, &serde_json::to_string(&b).unwrap()).is_err());
        assert_eq!(load(&c).unwrap().annotations.len(), 1);
    }
    #[test]
    fn import_rejects_highlights_outside_the_palette_atomically() {
        let mut c = db();
        let mut b: Backup = serde_json::from_str(&export(&c).unwrap()).unwrap();
        b.annotations = vec![
            note(),
            Annotation {
                id: "rogue".into(),
                kind: "highlight".into(),
                text: String::new(),
                color: "#000000".into(),
                ..note()
            },
        ];
        assert_eq!(
            import(&mut c, &serde_json::to_string(&b).unwrap()).unwrap_err(),
            "invalid_annotation"
        );
        assert!(load(&c).unwrap().annotations.is_empty());
    }
    #[test]
    fn import_does_not_enable_reporting() {
        let mut c = db();
        let mut b: Backup = serde_json::from_str(&export(&c).unwrap()).unwrap();
        b.preferences.crash_reports = true;
        import(&mut c, &serde_json::to_string(&b).unwrap()).unwrap();
        assert!(!load(&c).unwrap().preferences.crash_reports);
    }
    #[test]
    fn disk_survives_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.sqlite3");
        {
            let mut c = Connection::open(&path).unwrap();
            migrate(&mut c).unwrap();
            annotations::save(&c, &note()).unwrap();
        }
        let c = Connection::open(path).unwrap();
        assert_eq!(load(&c).unwrap().annotations[0], note());
    }
    #[test]
    fn older_conflict_is_preserved_once() {
        let mut c = db();
        let mut newer = note();
        newer.updated_at = "2026-03-01T00:00:00Z".into();
        newer.text = "Newer".into();
        annotations::save(&c, &newer).unwrap();
        let mut b: Backup = serde_json::from_str(&export(&c).unwrap()).unwrap();
        b.annotations = vec![note()];
        let json = serde_json::to_string(&b).unwrap();
        assert_eq!(import(&mut c, &json).unwrap().preserved, 1);
        assert_eq!(import(&mut c, &json).unwrap().preserved, 0);
        assert_eq!(load(&c).unwrap().annotations.len(), 2);
    }
    #[test]
    fn annotation_references_are_nonempty_sorted_unique() {
        for verses in [vec![], vec![2, 1], vec![1, 1]] {
            assert!(Annotation { verses, ..note() }.validate().is_err());
        }
        assert!(Annotation {
            reference: " ".into(),
            ..note()
        }
        .validate()
        .is_err());
    }
    #[test]
    fn direct_save_rejects_stale_or_changed_identity() {
        let c = db();
        let mut current = note();
        current.updated_at = "2026-03-01T00:00:00Z".into();
        annotations::save(&c, &current).unwrap();
        assert_eq!(
            annotations::save(&c, &note()).unwrap_err(),
            "stale_annotation"
        );
        let changed = Annotation {
            version_id: 1,
            ..current.clone()
        };
        assert_eq!(
            annotations::save(&c, &changed).unwrap_err(),
            "annotation_identity_conflict"
        );
        assert_eq!(load(&c).unwrap().annotations[0], current);
    }
    #[test]
    fn future_database_is_rejected() {
        let mut c = Connection::open_in_memory().unwrap();
        c.execute_batch("PRAGMA user_version=2").unwrap();
        assert!(migrate(&mut c).is_err());
    }
}
