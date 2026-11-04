# Decisions

Short log with date, decision, reason, and evidence. Formal architecture decisions live in [docs/adr/](../docs/adr/001-desktop-architecture.md). This file only links to them.

Format for a new entry:

```
## YYYY-MM-DD · Short title
- Decision. What was chosen.
- Reason. Why.
- Evidence. Commit, PR, or ADR.
- Status. Current | Superseded by <date · title>.
```

## 2026-10-22 · Tauri 2 with React and Rust
- Decision. Shared React interface on native webviews, with Rust exposing narrow commands.
- Reason and details in [ADR 001](../docs/adr/001-desktop-architecture.md).
- Status. Current.

## 2026-10-22 · YouVersion Platform serves Scripture online
- Decision. No persistent Scripture downloads.
- Reason and details in [ADR 002](../docs/adr/002-platform-boundary.md).
- Status. Current.

## 2026-10-22 · Personal data only in local SQLite
- Decision. No accounts or sync. Versioned JSON backups.
- Reason and details in [ADR 003](../docs/adr/003-local-personal-data.md).
- Status. Current.

## 2026-10-22 · Unsigned alpha authorized by the owner
- Decision. Publish experimental unsigned installers for the 6 targets, separate from the gated stable flow.
- Reason. Allow testing before signing, notarization, and licenses are in place.
- Evidence. Commits `9de3729` and `6ec3659`, [docs/RELEASE.md](../docs/RELEASE.md).
- Status. Current.

## 2026-10-22 · One alpha for every push to `main` with code
- Decision. The `alpha-on-push.yml` workflow creates `vX.Y.Z-alpha.N` and attaches installers. Docs-only changes and commits with `[skip release]` do not publish.
- Reason. Always have a test installer for the latest code.
- Evidence. Commit `fa59a1e`.
- Status. Current.

## 2026-10-22 · Sentry deferred
- Decision. Diagnostics off. If they are ever enabled, only toward the owner's personal project and with explicit consent.
- Reason. Owner's request. See [docs/PRIVACY.md](../docs/PRIVACY.md).
- Status. Current.

## 2026-10-22 · Save-first native quit
- Decision. Replace the predefined macOS Quit with a custom action that saves before quitting.
- Reason. The native macOS `terminate:` skips cancellable exit requests and lost the last keystrokes of a note.
- Evidence. Commit `b7fca15`, `src-tauri/src/lib.rs`.
- Status. Current.

## 2026-10-22 · "Hearth" visual identity
- Decision. Warm paper-and-ink palette with a single ember accent, Fraunces for headings and Source Serif 4 for Scripture and notes.
- Reason. Replace the purple dashboard look.
- Evidence. Commit `d78bffc`.
- Status. Current. If design.md exists at the repo root, it takes precedence for UI work.

## 2026-10-26 · No "Bible App" references
- Decision. Verse of the Day and the app do not mention Bible App.
- Reason. BibleHearth must not imply official YouVersion endorsement.
- Evidence. Commit `a95c1ac`.
- Status. Current.

## 2026-10-27 · Intent-based marking
- Decision. Highlights and bookmarks are created with `mark_passage`. `created_at` is no longer part of identity, and the earliest value wins on save and import.
- Reason. A single source of annotation rules in `src-tauri/src/annotations.rs`.
- Evidence. PR #2, commit `0d9e7a7`.
- Status. Current.

## 2026-11-03 · Persistent memory for agents
- Decision. `AGENTS.md` as the central control file, `CLAUDE.md` that only imports it, `rules.md` at the root, memory in `state/`, `decisions/`, `gotchas/`, `logs/`, and `skills/`.
- Reason. Keep context between sessions without loading the whole repo.
- Evidence. [AGENTS.md](../AGENTS.md), [rules.md](../rules.md), `skills/check-context.sh`.
- Status. Current.
