# Implementation verification — 22 October 2026

BibleHearth is implemented. The owner has authorized **unsigned experimental alpha installers**, but the app is **not cleared for a verified stable release**. Actual downloadable artifacts and their build status are listed in the GitHub prerelease notes.

## Alpha installer verification

- [v0.1.0-alpha.1](https://github.com/asvirts/biblehearth-desktop/releases/tag/v0.1.0-alpha.1) now provides eight experimental installers across all six native targets: two macOS DMGs, two Windows NSIS installers, and AppImage/Debian packages for both Linux architectures.
- [Native build run](https://github.com/asvirts/biblehearth-desktop/actions/runs/39819240150) passed frontend and Rust tests, packaging, upload, and checksum readback for each target. All installer digests also match GitHub's stored asset digests.
- Exact application source: `b7fca15410470fc55a6d032d928e9f73ab8e448e`; build workflow: `9de3729`. The release tag was not moved.
- The downloaded Apple Silicon DMG additionally passed disk-image integrity, bundle identity, and ARM64 executable checks. A fresh release-build UI check was unavailable because the local Mac was locked; earlier debug runtime checks below remain separate evidence.
- No publisher signing/notarization or automatic-update manifest. Sentry and automatic updates are disabled. Native interactive runtime verification on the other five targets remains outstanding.

## Verified locally

- Frontend production build and TypeScript check.
- 44 frontend tests: provider contract, translation completeness, autosave, persistence, diagnostics-consent, and updater behavior.
- 10 Rust tests: migrations, strict validation, disk reopen, transactional import, conflict preservation, and idempotency.
- Six release-evidence gate tests.
- Live app-licensed catalog and chapter returned HTTP 200. Provider pagination was corrected to 99 after live HTTP 400 at 100.
- Packaged macOS Apple Silicon debug app launches and renders real Scripture with attribution.
- Native search returns results and opens the correct book/chapter.
- Native note, bookmark, and highlight survive quit/relaunch. Immediate edit then Cmd+Q also preserves the last keystrokes after replacing macOS’s predefined Quit menu action with a save-first action. Verification-only library entries were removed afterward.
- Native JSON backup export succeeds; importing it reports zero additions/updates and three unchanged records.
- English, Spanish, Portuguese, Arabic, and Chinese custom settings inspected; Arabic mirrors layout without overflow. This is an engineering review, not native-speaker certification.

## Still required for verified stable release

- Confirm registered product identity, distribution configuration, and translation-specific license/attribution terms. Successful content access alone does not establish complete release rights.
- macOS signing/notarization, Windows signing, updater signing keys/feed, and release infrastructure.
- Installed-app runtime verification on Mac Intel, Windows x64/ARM64, Linux x64/ARM64, including X11/Wayland and Debian installs.
- Signed update, invalid-signature, and interrupted-download end-to-end checks.
- Full screen-reader/keyboard and RTL Scripture matrix on target operating systems.
- Sentry is intentionally unconfigured at the user's request; opt-in controls remain disabled until a personal project is configured.

The stable release workflows create draft candidates and require evidence before publication. The separate alpha workflow can publish unsigned experimental installers without enabling the stable updater. A successful build is not an installed-app verification result. All six targets remain planned; only the macOS Apple Silicon debug runtime checks above have been completed locally. No alpha installer is claimed to be signed, notarized, professionally translation-reviewed, or stable.
