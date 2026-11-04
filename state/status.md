# Status

Updated 2026-11-03 from `main` at `0d9e7a7`. Overwritten at the close of every important session.

## Done

- App implemented. Online reader with YouVersion, local library of notes, bookmarks, and highlights, search, Verse of the Day, JSON backup and import, 15 interface languages, light, dark, and system themes.
- "Hearth" visual redesign (warm paper, ink, ember accent, Fraunces and Source Serif 4). Commit `d78bffc`.
- Icon and brand mark aligned with biblehearth.online. Commit `66d41c1`.
- Annotation rules concentrated in `src-tauri/src/annotations.rs`. Highlights and bookmarks are created by intent (`mark_passage`). PR #2, commit `0d9e7a7`.
- Automatic alpha on every push to `main` with code. Latest tag `v0.1.0-alpha.6` (2026-10-27).
- `v0.1.0-alpha.1` published 8 installers for the 6 native targets with verified checksums.
- Verified locally only on macOS Apple Silicon (debug build). Exact list in [docs/implementation-status.md](../docs/implementation-status.md).

## In progress

- Nothing recorded.

## Pending

- Installed-app testing on macOS Intel, Windows x64 and ARM64, Linux x64 and ARM64 (X11, Wayland, Debian package).
- Screen reader, keyboard, and RTL Scripture matrix on each operating system.
- Signed update, invalid signature, and interrupted download tests.
- Translation review by native speakers. Only an engineering review was done in English, Spanish, Portuguese, Arabic, and Chinese.

## Stable release blockers

Full list in [docs/RELEASE.md](../docs/RELEASE.md), section "Current stable-release blockers".

- No content-license receipt or confirmation of the app's registered identity.
- No macOS signing or notarization. No Windows signing (the infrastructure is not provisioned in the repo).
- No updater signing keys or `latest.json` feed.
- Availability of native GitHub ARM runners is unconfirmed.
- Sentry deferred by the owner's decision.
