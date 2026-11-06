# Gotchas

Known problems with symptom, cause, and fix. Delete an entry once it stops reproducing.

## The YouVersion catalog answers HTTP 400
- Symptom. The version list does not load.
- Cause. A `page_size` of 100. The API accepts at most 99.
- Fix. Keep `page_size: 99` in `src/platform/index.tsx`. Rule R9.

## Cmd+Q on macOS lost the last keystrokes of a note
- Symptom. Editing a note and quitting right away loses the last typed text.
- Cause. The predefined macOS Quit calls `terminate:` and skips cancellable exit requests.
- Fix. Already solved. The menu uses the custom `biblehearth.quit` item, which saves before quitting (`src-tauri/src/lib.rs`). Do not go back to the predefined Quit.

## The browser preview is not the app
- Symptom. Something works in `bun run dev` and fails on the desktop, or the other way around.
- Cause. Without Tauri there is no SQLite, native menu, dialogs, or controlled quit.
- Fix. Test persistence, backups, windows, and quitting in `bun run tauri dev`.

## A push to `main` publishes a release
- Symptom. A `v*-alpha.N` tag and a new prerelease appear after a push.
- Cause. `alpha-on-push.yml` runs on every push to `main` that is not docs-only. Only `docs/**`, `**/*.md`, `LICENSE`, `.gitignore`, and `.github/dependabot.yml` are ignored.
- Fix. Work on branches. For a push to `main` that must not publish, put `[skip release]` in the commit message.

## Misaligned versions break the alpha
- Symptom. The alpha workflow fails when creating the tag.
- Cause. `package.json` and `src-tauri/tauri.conf.json` must have the same version.
- Fix. Bump the version in `package.json`, `tauri.conf.json`, and `Cargo.toml` together. Rule R12.

## An annotation's `text` field is not Scripture
- Symptom. It looks like the backup stores Bible text.
- Cause. `Annotation.text` is the text of the user's note. The verse is never stored.
- Fix. Do not rename or reuse that field for Bible content. Rule R1.

## No YouVersion key, no Scripture
- Symptom. The reader loads no content.
- Cause. `VITE_YVP_APP_KEY` is missing from `.env.local`, or the registered app is not licensed for that translation.
- Fix. `cp .env.example .env.local` and set the registered client key. A missing translation can be a licensing matter, not a bug.

## Building an older alpha tag
- Symptom. A manual build of an older alpha does not match its scripts.
- Cause. The workflow runs from a different revision than the tag.
- Fix. When dispatching **Build unsigned alpha installers** for an older tag, pick the workflow revision from that same tag. Commit `2041ce9`.

## Linux ARM and Windows ARM depend on native runners
- Symptom. The stable candidate does not start for ARM.
- Cause. It needs the `ubuntu-22.04-arm` and `windows-11-arm` runners. There is no emulation fallback.
- Fix. Confirm access to those runners. See [docs/RELEASE.md](../docs/RELEASE.md).
