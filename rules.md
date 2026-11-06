# Rules

What an agent never does in this repo. Each rule says how it is detected. Rules marked `auto` are checked by `bash skills/check-context.sh`.

## Data and privacy

| ID | Never | How it is detected |
|---|---|---|
| R1 | Store Bible text in SQLite, in a backup, or in a local file. | The diff adds a field with verse content to `Annotation`, `Backup`, or `Location` (in `src-tauri/src/annotations.rs` and `storage.rs`). The existing `text` field is the user's note and does not count. |
| R2 | Create an annotation as a side effect of selecting text. | A test or a manual run shows a new record after only selecting. `annotate` scenario in [docs/VERIFICATION.md](docs/VERIFICATION.md). |
| R3 | Change the SQLite schema or the backup shape without bumping its version and adding a migration. | The diff touches `CREATE TABLE` or the `Backup` struct in `storage.rs` and does not change `PRAGMA user_version` or `schema_version`. |
| R4 | Drop a note's text during an import conflict. | The Rust conflict-preservation test fails (`cargo test`). |
| R5 | Commit `.env` or `.env.local`, keys (`*.key`, `*.p12`, `*.pfx`), `release-config.json`, `release.json`, backups, or databases. | `auto`. `git ls-files` lists one of those files. |
| R6 | Put a secret in a `VITE_` variable. Everything `VITE_` ends up in the frontend. | `auto`. A `VITE_` name containing `SECRET`, `TOKEN`, `PRIVATE`, or `PASSWORD` in `src/` or `.env.example`. |
| R7 | Fill in a Sentry DSN or set `VITE_UPDATES_ENABLED=true` in `.env.example`. | `auto`. A non-empty value in `VITE_SENTRY_DSN` or `BIBLEHEARTH_SENTRY_DSN`, or `VITE_UPDATES_ENABLED` other than `false`. |

## Platform and permissions

| ID | Never | How it is detected |
|---|---|---|
| R8 | Give the webview `fs:` or `shell:` permissions. | `auto`. They appear in `src-tauri/capabilities/*.json`. |
| R9 | Ask the YouVersion catalog for more than 99 results per page. At 100 it answers HTTP 400. | `auto`. A `page_size` above 99 in `src/platform/index.tsx`. |
| R10 | Write "Bible App" in the app or the docs, or imply official YouVersion endorsement. | `auto`. `grep -rn "Bible App" src docs README.md` returns something. |
| R11 | Add interface text in only one language. | `tests/locales.test.ts` fails (`bun run test`). |

## Releases

| ID | Never | How it is detected |
|---|---|---|
| R12 | Let the versions in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` drift apart. | `auto`. The three versions are not equal. |
| R13 | Publish `latest.json` or enable `createUpdaterArtifacts` from an alpha workflow. | `auto`. `latest.json` or `"createUpdaterArtifacts": true` appears in `.github/workflows/alpha-*.yml`. |
| R14 | Push or merge to `main` without an explicit request from the owner. Every push with code publishes an alpha. | A `v*-alpha.N` tag or a commit on `main` with no request from the owner in the session. |
| R15 | Describe an installer as signed, notarized, stable, or verified without a receipt from an installed test. | The diff to release notes, README, or [docs/implementation-status.md](docs/implementation-status.md) claims verification without linking evidence. |
| R16 | Fabricate release evidence, placeholder signatures, or a `release-evidence.json` with invented data. | `scripts/release-gate.mjs` fails, or the diff adds evidence with no real receipt. |
| R17 | Give commands that disable Gatekeeper, SmartScreen, or another system protection. | The docs or release-notes diff includes `xattr -d com.apple.quarantine`, `spctl --master-disable`, or similar. |

## Repo and memory

| ID | Never | How it is detected |
|---|---|---|
| R18 | Let `AGENTS.md` exceed 300 lines or a session log exceed 40. | `auto`. `wc -l`. |
| R19 | Leave a broken internal link in memory (`AGENTS.md`, `rules.md`, `decisions/`, `state/`, `gotchas/`, `logs/`, `skills/`). | `auto`. The link points to a file that does not exist. |
| R20 | Copy an ADR, the git history, or a whole document into memory instead of linking it. | A block of more than 10 lines in `decisions/`, `state/`, or `logs/` repeats text from `docs/` or `git log`. |
