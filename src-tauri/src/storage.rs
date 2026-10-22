use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Annotation {
    pub id: String,
    pub kind: String,
    pub version_id: u64,
    pub book: String,
    pub chapter: u32,
    pub verses: Vec<u32>,
    pub reference: String,
    pub text: String,
    pub color: String,
    pub created_at: String,
    pub updated_at: String,
}
impl Annotation {
    pub fn validate(&self) -> Result<()> {
        Location {
            version_id: self.version_id,
            book: self.book.clone(),
            chapter: self.chapter,
        }
        .validate()?;
        if self.id.is_empty()
            || self.id.len() > 200
            || !self
                .id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
            || !["note", "bookmark", "highlight"].contains(&self.kind.as_str())
            || self.verses.is_empty()
            || self.verses.windows(2).any(|pair| pair[0] >= pair[1])
            || self.verses.len() > 200
            || self.verses.iter().any(|v| *v == 0 || *v > 200)
            || self.reference.trim().is_empty()
            || self.reference.len() > 160
            || self.text.len() > 100_000
            || self.color.len() > 32
            || (self.kind != "note" && !self.text.is_empty())
        {
            return Err("invalid_annotation".into());
        }
        let created = chrono::DateTime::parse_from_rfc3339(&self.created_at)
            .map_err(|_| "invalid_timestamp")?;
        let updated = chrono::DateTime::parse_from_rfc3339(&self.updated_at)
            .map_err(|_| "invalid_timestamp")?;
        if updated < created {
            return Err("invalid_timestamp".into());
        }
        Ok(())
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub preferences: Preferences,
    pub location: Option<Location>,
    pub annotations: Vec<Annotation>,
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
fn err(_: impl std::fmt::Display) -> String {
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
    let mut stmt = c
        .prepare("SELECT value FROM annotations ORDER BY id")
        .map_err(err)?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(err)?;
    let annotations = rows
        .map(|row| serde_json::from_str(&row.map_err(err)?).map_err(err))
        .collect::<Result<Vec<_>>>()?;
    Ok(AppState {
        preferences,
        location,
        annotations,
    })
}
pub fn setting<T: Serialize>(c: &Connection, key: &str, value: &T) -> Result<()> {
    c.execute("INSERT INTO settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![key,serde_json::to_string(value).map_err(err)?]).map_err(err)?;
    Ok(())
}
pub fn upsert(c: &Connection, a: &Annotation) -> Result<()> {
    a.validate()?;
    use rusqlite::OptionalExtension;
    let stored: Option<String> = c
        .query_row("SELECT value FROM annotations WHERE id=?1", [&a.id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(err)?;
    if let Some(json) = stored {
        let old: Annotation = serde_json::from_str(&json).map_err(err)?;
        if old.kind != a.kind
            || old.version_id != a.version_id
            || old.book != a.book
            || old.chapter != a.chapter
            || old.verses != a.verses
            || old.created_at != a.created_at
        {
            return Err("annotation_identity_conflict".into());
        }
        if chrono::DateTime::parse_from_rfc3339(&a.updated_at).unwrap()
            < chrono::DateTime::parse_from_rfc3339(&old.updated_at)
                .map_err(|_| "invalid_timestamp")?
        {
            return Err("stale_annotation".into());
        }
    }
    c.execute("INSERT INTO annotations(id,value) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET value=excluded.value",params![a.id,serde_json::to_string(a).map_err(err)?]).map_err(err)?;
    Ok(())
}
pub fn delete(c: &Connection, id: &str) -> Result<()> {
    c.execute("DELETE FROM annotations WHERE id=?1", [id])
        .map_err(err)?;
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
    let mut existing: std::collections::HashMap<String, Annotation> = current
        .annotations
        .into_iter()
        .map(|a| (a.id.clone(), a))
        .collect();
    let mut summary = ImportSummary::default();
    for incoming in backup.annotations {
        if let Some(old) = existing.get(&incoming.id).cloned() {
            if old == incoming {
                summary.skipped += 1;
                continue;
            }
            // A stable ID cannot silently change passage or annotation type.
            if old.kind != incoming.kind
                || old.version_id != incoming.version_id
                || old.book != incoming.book
                || old.chapter != incoming.chapter
                || old.verses != incoming.verses
            {
                return Err("annotation_identity_conflict".into());
            }
            let newer = chrono::DateTime::parse_from_rfc3339(&incoming.updated_at).unwrap()
                > chrono::DateTime::parse_from_rfc3339(&old.updated_at).unwrap();
            if old.kind == "note" && old.text != incoming.text {
                let mut preserved = if newer { old.clone() } else { incoming.clone() };
                // Canonical content-derived key makes repeated imports idempotent.
                let digest =
                    Sha256::digest(format!("{}\0{}", incoming.id, preserved.text).as_bytes());
                preserved.id = format!("conflict-{:x}", digest);
                if let Some(collision) = existing.get(&preserved.id) {
                    if collision.text != preserved.text
                        || collision.kind != "note"
                        || collision.version_id != preserved.version_id
                        || collision.book != preserved.book
                        || collision.chapter != preserved.chapter
                        || collision.verses != preserved.verses
                    {
                        return Err("annotation_identity_conflict".into());
                    }
                }
                if !existing.contains_key(&preserved.id) {
                    upsert(&tx, &preserved)?;
                    existing.insert(preserved.id.clone(), preserved);
                    summary.preserved += 1;
                }
            }
            if newer {
                upsert(&tx, &incoming)?;
                existing.insert(incoming.id.clone(), incoming);
                summary.updated += 1;
            } else {
                summary.skipped += 1;
            }
        } else {
            upsert(&tx, &incoming)?;
            existing.insert(incoming.id.clone(), incoming);
            summary.inserted += 1;
        }
    }
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
        upsert(&c, &note()).unwrap();
        assert_eq!(load(&c).unwrap().annotations[0], note());
        delete(&c, "test-note").unwrap();
        assert!(load(&c).unwrap().annotations.is_empty());
    }
    #[test]
    fn conflict_import_is_idempotent() {
        let mut c = db();
        upsert(&c, &note()).unwrap();
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
        upsert(&c, &note()).unwrap();
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
            upsert(&c, &note()).unwrap();
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
        upsert(&c, &newer).unwrap();
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
        upsert(&c, &current).unwrap();
        assert_eq!(upsert(&c, &note()).unwrap_err(), "stale_annotation");
        let changed = Annotation {
            version_id: 1,
            ..current.clone()
        };
        assert_eq!(
            upsert(&c, &changed).unwrap_err(),
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
