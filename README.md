# BibleHearth

A free desktop Bible reader for macOS, Windows, and Linux, built with Tauri 2, Rust, React, TypeScript, Vite, and SQLite. Scripture comes from YouVersion Platform. Personal notes, bookmarks, highlights, preferences, and reading position belong to this app and stay on your device.

**Development status:** implementation is not public-release certification. Licensed content access, signing, telemetry configuration, and native testing of all six architectures must pass before publication. See [release operations](docs/RELEASE.md).

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

When verified releases are available, use [GitHub Releases](https://github.com/asvirts/biblehearth-desktop/releases). Choose your OS and CPU architecture: macOS DMG, Windows NSIS installer, or Linux AppImage/Debian package. Linux AppImages require executable permission and compatible WebKitGTK/system dependencies. Debian installations update through downloaded packages; do not replace them using the AppImage updater.

See [support](docs/SUPPORT.md), [privacy](docs/PRIVACY.md), [verification checklist](docs/VERIFICATION.md), and [domain glossary](GLOSSARY.md).

Application source is [MIT licensed](LICENSE). Scripture, YouVersion SDKs, fonts, and other dependencies retain their own licenses; the MIT license does not grant Bible translation distribution rights. BibleHearth is independently named and must not imply official YouVersion endorsement.
