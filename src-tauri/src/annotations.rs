use crate::storage::{err, ImportSummary, Location, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

// The Highlight color palette, in the order the reader offers it.
pub const HIGHLIGHT_COLORS: [&str; 4] = ["#B9A0E6", "#F0907A", "#7CC3B2", "#F0C063"];

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
            || (self.kind == "highlight" && !HIGHLIGHT_COLORS.contains(&self.color.as_str()))
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
    // Same kind on the same version-specific passage. created_at is metadata, not identity.
    fn same_identity(&self, other: &Annotation) -> bool {
        self.kind == other.kind
            && self.version_id == other.version_id
            && self.book == other.book
            && self.chapter == other.chapter
            && self.verses == other.verses
    }
}

pub fn load_all(c: &Connection) -> Result<Vec<Annotation>> {
    let mut stmt = c
        .prepare("SELECT value FROM annotations ORDER BY id")
        .map_err(err)?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(err)?;
    rows.map(|row| serde_json::from_str(&row.map_err(err)?).map_err(err))
        .collect()
}

fn write(c: &Connection, a: &Annotation) -> Result<()> {
    c.execute("INSERT INTO annotations(id,value) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET value=excluded.value",params![a.id,serde_json::to_string(a).map_err(err)?]).map_err(err)?;
    Ok(())
}

// Returns the stored copy: created_at keeps the earliest value ever seen for the record.
pub fn save(c: &Connection, a: &Annotation) -> Result<Annotation> {
    a.validate()?;
    let mut a = a.clone();
    let stored: Option<String> = c
        .query_row("SELECT value FROM annotations WHERE id=?1", [&a.id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(err)?;
    if let Some(json) = stored {
        let old: Annotation = serde_json::from_str(&json).map_err(err)?;
        if !old.same_identity(&a) {
            return Err("annotation_identity_conflict".into());
        }
        if chrono::DateTime::parse_from_rfc3339(&a.updated_at).unwrap()
            < chrono::DateTime::parse_from_rfc3339(&old.updated_at)
                .map_err(|_| "invalid_timestamp")?
        {
            return Err("stale_annotation".into());
        }
        if chrono::DateTime::parse_from_rfc3339(&old.created_at).map_err(|_| "invalid_timestamp")?
            < chrono::DateTime::parse_from_rfc3339(&a.created_at)
                .map_err(|_| "invalid_timestamp")?
        {
            a.created_at = old.created_at;
        }
    }
    write(c, &a)?;
    Ok(a)
}

// Intent to highlight or bookmark a passage. The module assigns id and timestamps.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Mark {
    pub kind: String,
    pub version_id: u64,
    pub book: String,
    pub chapter: u32,
    pub verses: Vec<u32>,
    pub reference: String,
    pub color: String,
}

fn timestamp(t: chrono::DateTime<chrono::Utc>) -> String {
    t.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn mark(c: &Connection, m: &Mark) -> Result<()> {
    // Notes keep their record-shaped path; marking one would overwrite its text.
    if !["highlight", "bookmark"].contains(&m.kind.as_str()) {
        return Err("invalid_annotation".into());
    }
    let tx = c.unchecked_transaction().map_err(err)?;
    let c = &tx;
    let now = chrono::Utc::now();
    let mut next = Annotation {
        id: String::new(),
        kind: m.kind.clone(),
        version_id: m.version_id,
        book: m.book.clone(),
        chapter: m.chapter,
        verses: m.verses.clone(),
        reference: m.reference.clone(),
        text: String::new(),
        color: m.color.clone(),
        created_at: timestamp(now),
        updated_at: timestamp(now),
    };
    match load_all(c)?.into_iter().find(|a| a.same_identity(&next)) {
        Some(old) => {
            // Strictly later than the stored copy, so the stale check always accepts it.
            let old_updated = chrono::DateTime::parse_from_rfc3339(&old.updated_at)
                .map_err(|_| "invalid_timestamp")?
                .with_timezone(&chrono::Utc);
            next.id = old.id;
            next.created_at = old.created_at;
            next.updated_at = timestamp(now.max(old_updated + chrono::Duration::milliseconds(1)));
        }
        None => {
            let digest = Sha256::digest(
                format!(
                    "{}\0{}\0{}\0{}\0{:?}",
                    m.kind, m.version_id, m.book, m.chapter, m.verses
                )
                .as_bytes(),
            );
            next.id = format!("mark-{:x}-{}", digest, now.timestamp_millis());
        }
    }
    save(c, &next)?;
    tx.commit().map_err(err)
}

pub fn delete(c: &Connection, id: &str) -> Result<()> {
    c.execute("DELETE FROM annotations WHERE id=?1", [id])
        .map_err(err)?;
    Ok(())
}

fn parse(t: &str) -> chrono::DateTime<chrono::FixedOffset> {
    // Callers validate timestamps before they reach the merge.
    chrono::DateTime::parse_from_rfc3339(t).unwrap()
}

pub fn merge(tx: &Connection, incoming: Vec<Annotation>) -> Result<ImportSummary> {
    let mut existing: HashMap<String, Annotation> = load_all(tx)?
        .into_iter()
        .map(|a| (a.id.clone(), a))
        .collect();
    let mut summary = ImportSummary::default();
    for incoming in incoming {
        if let Some(old) = existing.get(&incoming.id).cloned() {
            if old == incoming {
                summary.skipped += 1;
                continue;
            }
            // A stable ID cannot silently change passage or annotation type.
            if !old.same_identity(&incoming) {
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
                    if collision.text != preserved.text || !collision.same_identity(&preserved) {
                        return Err("annotation_identity_conflict".into());
                    }
                }
                if !existing.contains_key(&preserved.id) {
                    let stored = save(tx, &preserved)?;
                    existing.insert(stored.id.clone(), stored);
                    summary.preserved += 1;
                }
            }
            if newer {
                let stored = save(tx, &incoming)?;
                existing.insert(stored.id.clone(), stored);
                summary.updated += 1;
            } else {
                if parse(&incoming.created_at) < parse(&old.created_at) {
                    let stored = save(
                        tx,
                        &Annotation {
                            created_at: incoming.created_at,
                            ..old
                        },
                    )?;
                    existing.insert(stored.id.clone(), stored);
                }
                summary.skipped += 1;
            }
        } else {
            let stored = save(tx, &incoming)?;
            existing.insert(stored.id.clone(), stored);
            summary.inserted += 1;
        }
    }
    Ok(summary)
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::migrate;
    fn db() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        migrate(&mut c).unwrap();
        c
    }
    fn passage() -> Mark {
        Mark {
            kind: "highlight".into(),
            version_id: 111,
            book: "JHN".into(),
            chapter: 1,
            verses: vec![1],
            reference: "John 1:1".into(),
            color: "#B9A0E6".into(),
        }
    }
    #[test]
    fn marking_a_passage_again_updates_the_existing_mark() {
        let c = db();
        mark(&c, &passage()).unwrap();
        let first = load_all(&c).unwrap();
        mark(
            &c,
            &Mark {
                color: "#F0907A".into(),
                ..passage()
            },
        )
        .unwrap();
        let all = load_all(&c).unwrap();
        assert_eq!(all.len(), 1);
        assert_eq!(all[0].id, first[0].id);
        assert_eq!(all[0].created_at, first[0].created_at);
        assert!(all[0].updated_at > first[0].updated_at);
        assert_eq!(all[0].color, "#F0907A");
    }
    #[test]
    fn highlights_outside_the_palette_are_rejected() {
        let c = db();
        let rogue = Mark {
            color: "#000000".into(),
            ..passage()
        };
        assert_eq!(mark(&c, &rogue).unwrap_err(), "invalid_annotation");
        assert!(load_all(&c).unwrap().is_empty());
        mark(&c, &passage()).unwrap();
        let mut saved = load_all(&c).unwrap().remove(0);
        saved.color = "violet".into();
        assert_eq!(save(&c, &saved).unwrap_err(), "invalid_annotation");
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
            color: String::new(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }
    }
    #[test]
    fn created_at_is_not_identity_and_the_earliest_wins() {
        for (created, expected) in [
            ("2026-02-01T00:00:00Z", "2026-01-01T00:00:00Z"),
            ("2025-12-01T00:00:00Z", "2025-12-01T00:00:00Z"),
        ] {
            let revised = Annotation {
                created_at: created.into(),
                updated_at: "2026-03-01T00:00:00Z".into(),
                ..note()
            };
            let c = db();
            save(&c, &note()).unwrap();
            save(&c, &revised).unwrap();
            let c2 = db();
            save(&c2, &note()).unwrap();
            let summary = merge(&c2, vec![revised]).unwrap();
            assert_eq!(summary.updated, 1);
            for conn in [&c, &c2] {
                let stored = load_all(conn).unwrap();
                assert_eq!(stored[0].created_at, expected);
                assert_eq!(stored.len(), 1);
                assert_eq!(stored[0].updated_at, "2026-03-01T00:00:00Z");
            }
        }
    }
    #[test]
    fn marking_never_touches_notes() {
        let c = db();
        save(&c, &note()).unwrap();
        let as_note = Mark {
            kind: "note".into(),
            ..passage()
        };
        assert_eq!(mark(&c, &as_note).unwrap_err(), "invalid_annotation");
        assert_eq!(load_all(&c).unwrap(), vec![note()]);
    }
    #[test]
    fn import_lowers_created_at_even_when_the_incoming_copy_is_not_newer() {
        let c = db();
        let stored = Annotation {
            created_at: "2026-02-01T00:00:00Z".into(),
            updated_at: "2026-03-01T00:00:00Z".into(),
            ..note()
        };
        save(&c, &stored).unwrap();
        let older = Annotation {
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-02-15T00:00:00Z".into(),
            ..note()
        };
        assert_eq!(merge(&c, vec![older]).unwrap().skipped, 1);
        let kept = load_all(&c).unwrap();
        assert_eq!(kept[0].created_at, "2026-01-01T00:00:00Z");
        assert_eq!(kept[0].updated_at, "2026-03-01T00:00:00Z");
    }
}
