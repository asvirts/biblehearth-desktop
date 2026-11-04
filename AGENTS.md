# AGENTS.md

Central control file for agents working on BibleHearth. Read it first. Load everything else on demand.

## Identity and purpose

BibleHearth is a free desktop Bible reader for macOS, Windows, and Linux.

- Stack. Tauri 2 + Rust + SQLite in the native backend. React 19 + TypeScript + Vite in the interface. Bun 1.3.14 as the package manager.
- Scripture is fetched online from YouVersion Platform (SDK `@youversion/platform-*` 2.15.0). It is never stored locally.
- Personal data (notes, bookmarks, highlights, preferences, reading position) lives only on the device, in SQLite.
- No accounts, no cloud sync, no audio, no parallel reader, no advertising, no paid tier.
- Current phase. Unsigned experimental alpha. Details in [state/status.md](state/status.md).

## Hard rules and invariants

The detectable red lines are in [rules.md](rules.md). These are the product invariants behind them:

1. Scripture is never persisted. SQLite and backups store references (`version_id`, book, chapter, verses), not Bible text. See [ADR 002](docs/adr/002-platform-boundary.md).
2. SQLite is the source of truth for personal data. Every annotation carries a version and a canonical reference. See [ADR 003](docs/adr/003-local-personal-data.md).
3. The frontend has no general file system or shell access. Rust exposes narrow, validated commands. See [ADR 001](docs/adr/001-desktop-architecture.md).
4. Selecting text never creates an annotation. Marking a passage again updates the existing mark. Vocabulary in [GLOSSARY.md](GLOSSARY.md).
5. Pending edits are saved before navigating, before restarting, and before quitting. A failed save is shown to the user.
6. A green build is not runtime verification. No alpha is signed, notarized, or stable.
7. Sentry and automatic updates are off.
8. YouVersion attribution is kept. The app never implies official YouVersion endorsement.

## Context behavior rules

- The context window is expensive and volatile. Real memory lives in files.
- Never load the whole history or every file in the project.
- Load only what the current task strictly needs.
- At the end of every important session, update `state/`, record decisions, and compress what is worth keeping into `logs/`.
- Prefer referencing files over copying long content into the prompt.
- Turn repetitive procedures into reusable skills.
- Keep AGENTS.md concise and information-dense.
- When closing an important session, run [skills/update-context.md](skills/update-context.md).

How they apply here:

- Do not read `bun.lock` (over 200 KB), `src-tauri/Cargo.lock`, `src-tauri/icons/`, or `src-tauri/gen/` unless the task is exactly about them.
- Read `src/App.tsx` (about 1360 lines) and `src/styles.css` (about 1870 lines) by section. Grep for the symbol or selector and read that range.
- `docs/RELEASE.md` is long. Read it only for release or CI tasks.
- `logs/` is history. Do not read it at the start. Open a log only when `state/` points to it.
- If a fact already lives in a repo file, link it. Do not copy it into memory.

## Reading order

Read in this order and stop as soon as you have what the task needs.

1. This file.
2. [rules.md](rules.md). Always, before changing anything.
3. [state/status.md](state/status.md). What is done, what is pending, what blocks.
4. Depending on the task:
   - UI, styles, typography, color, layout. If design.md exists at the repo root, it is the source of truth for UI work. Read it before touching any interface. If it does not exist, follow the patterns already in `src/styles.css` and do not invent a new system.
   - Domain and data. [GLOSSARY.md](GLOSSARY.md) and [docs/adr/](docs/adr/001-desktop-architecture.md).
   - Earlier decisions. [decisions/decisions.md](decisions/decisions.md).
   - Something odd, or something that failed before. [gotchas/gotchas.md](gotchas/gotchas.md).
5. The code you are about to change, nothing more.

## Repository map

| Path | Contents |
|---|---|
| `src/App.tsx` | The whole reader, library, and settings UI |
| `src/platform/index.tsx` | YouVersion Platform adapter (catalog, chapters, search) |
| `src/storage.ts` | TypeScript bridge to the Rust persistence commands |
| `src/locales.ts`, `src/i18n.ts` | 15 interface languages |
| `src/updates.ts`, `src/diagnostics.ts` | Updater and Sentry, both off |
| `src-tauri/src/annotations.rs` | Annotation identity, palette, ordering, and import merge |
| `src-tauri/src/storage.rs` | SQLite, migrations, backup, and import |
| `src-tauri/src/lib.rs` | Tauri commands, native menu, and save-first quit |
| `src-tauri/src/window.rs` | Main window default size and placement |
| `src-tauri/capabilities/` | Webview permissions |
| `tests/` | Vitest (frontend) |
| `scripts/release-*.mjs` | Release gates and download table |
| `.github/workflows/` | CI, automatic alpha on every push to `main`, candidates, and stable publication |

## Which skill to use for each task

| Task | Read | Check with |
|---|---|---|
| UI or styles | design.md if it exists, the relevant section of `src/styles.css` | `bun run typecheck`, `bun run test`, preview with `bun run dev` (port 1420) |
| Persistence, annotations, backup | [ADR 003](docs/adr/003-local-personal-data.md), [GLOSSARY.md](GLOSSARY.md), `annotations.rs`, `storage.rs` | `cargo test --manifest-path src-tauri/Cargo.toml` and a run in `bun run tauri dev` |
| Scripture, catalog, search | [ADR 002](docs/adr/002-platform-boundary.md), `src/platform/index.tsx` | `bun run test` and a run with a real key in `.env.local` |
| Translations | `src/locales.ts` | `bun run test` (includes locale completeness) |
| Release, CI, installers | [docs/RELEASE.md](docs/RELEASE.md), [docs/VERIFICATION.md](docs/VERIFICATION.md) | `node --test scripts/release-gate.test.mjs scripts/release-downloads.test.mjs` |
| Privacy or diagnostics | [docs/PRIVACY.md](docs/PRIVACY.md) | `bun run test` (diagnostics consent) |
| Closing an important session | [skills/update-context.md](skills/update-context.md) | `bash skills/check-context.sh` |
| Checking that memory and rules are healthy | [rules.md](rules.md) | `bash skills/check-context.sh` |

## Definition of Done

A task is done when everything that applies is true:

1. The checks for what you touched pass. Frontend `bun run typecheck`, `bun run test`, `bun run build`. Rust `cargo test --manifest-path src-tauri/Cargo.toml`. Release `node --test scripts/*.test.mjs`.
2. If you touched persistence, the native menu, windows, or quitting, you tried it in `bun run tauri dev`. The browser preview does not exercise SQLite or native behavior.
3. If you touched UI, it matches design.md when that file exists, and it works in light theme, dark theme, and Arabic (RTL).
4. `bash skills/check-context.sh` finishes with no failures.
5. If a domain term changed, you updated [GLOSSARY.md](GLOSSARY.md). If the verified status changed, you updated [docs/implementation-status.md](docs/implementation-status.md) with its evidence.
6. Commit on a branch with an English, imperative, concrete message, like the rest of the history. No push to `main` without an explicit request from the owner.
7. If it was an important session, you ran [skills/update-context.md](skills/update-context.md).

## Persistent memory

| Folder | Purpose | When to read |
|---|---|---|
| [rules.md](rules.md) | What is never done, and how to detect it | Always |
| [state/](state/status.md) | Done, pending, blockers | At the start |
| [decisions/](decisions/decisions.md) | Dated decisions with reasons, pointing to `docs/adr/` | Before changing a decision |
| [gotchas/](gotchas/gotchas.md) | Known problems and their fixes | When something fails or looks off |
| [logs/](logs/README.md) | Compressed summaries of important sessions | Only when `state/` asks for it |
| [skills/](skills/update-context.md) | Repeatable procedures | When closing a session or checking |

Writing memory:

- `state/` is overwritten. It reflects now, not history.
- `decisions/` only grows. A reverted decision is marked as superseded, never deleted.
- `gotchas/` is pruned. If a gotcha no longer reproduces, delete it.
- `logs/` holds one file per important session, at most 40 lines each.
- The ADRs in `docs/adr/` are the formal version. `decisions/` links to them and does not duplicate them.
