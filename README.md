# BibleHearth

A free desktop Bible reader for macOS, Windows, and Linux, built with Tauri 2, Rust, React, TypeScript, Vite, and SQLite. Scripture comes from YouVersion Platform. Personal notes, bookmarks, highlights, preferences, and reading position belong to this app and stay on your device.

**Alpha status:** every push to `main` automatically publishes an experimental, unsigned alpha prerelease with installer builds for testing. They are unsigned and are not certified stable releases. Compilation does not establish native runtime support; only the macOS Apple Silicon debug app has completed the local checks listed in [verification status](docs/implementation-status.md). Stable publication retains signing, licensing, and six-target verification gates. See [release operations](docs/RELEASE.md).

## Development

Install Bun 1.3.14, Node.js 22+, Rust stable, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). Run:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run tauri dev
```

Set `VITE_YVP_APP_KEY` to your registered Platform client key. It is embedded in the frontend and is not a server secret. Registration and translation licenses are required for real content access. Never put server credentials in a `VITE_` variable. The browser preview (`bun run dev`) is useful for UI development; native persistence and desktop behavior require Tauri.

```sh
bun run typecheck
bun run test --run
bun run build
cargo test --manifest-path src-tauri/Cargo.toml
bun run tauri build
```

## Product boundaries

Online Scripture; local personal data; no account, cloud sync, audio, parallel reader, advertising, or paid tier. No persistent Scripture downloads. Backup files contain personal data and references and should be stored privately. The interface supports English, Afrikaans, Arabic, Czech, Welsh, German, Spanish, French, Korean, Norwegian, Portuguese, Serbian, Turkish, Vietnamese, and Chinese. Translation completeness does not constitute professional linguistic review.

## Installation and support

Use the assets attached to [GitHub Releases](https://github.com/asvirts/biblehearth-desktop/releases); the release notes identify the actual available builds and their verification status. Choose your OS and CPU architecture: macOS DMG, Windows NSIS installer, or Linux AppImage/Debian package. A source archive is not an installer.

New releases label downloads for **macOS Apple Silicon**, **macOS Intel**, **Windows x64** (Intel/AMD), **Windows ARM64**, **Linux x64**, and **Linux ARM64**. Use the release page’s download table to choose the right installer.

Alpha installers are unsigned experimental builds. macOS may block an unnotarized app, and Windows may show an unknown-publisher warning. Follow your organization’s security policy; signing and notarization are planned for verified releases. Alpha builds do not use automatic updates: download a newer installer manually and export your personal-data backup first. Linux AppImages require executable permission and compatible WebKitGTK/system dependencies. Debian installations update through downloaded packages; do not replace them using the AppImage updater.

See [support](docs/SUPPORT.md), [privacy](docs/PRIVACY.md), [verification checklist](docs/VERIFICATION.md), and [domain glossary](GLOSSARY.md).

Application source is [MIT licensed](LICENSE). Scripture, YouVersion SDKs, fonts, and other dependencies retain their own licenses; the MIT license does not grant Bible translation distribution rights. BibleHearth is independently named and must not imply official YouVersion endorsement.
