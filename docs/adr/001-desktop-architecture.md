# ADR 001: Tauri desktop architecture

Status: accepted.

Use Tauri 2 with React/TypeScript/Vite for a shared interface across macOS, Windows, and Linux. Rust exposes narrow persistence and desktop commands; SQLite stores personal data. No general filesystem or shell access is exposed to the frontend. Native OS webviews reduce bundled browser footprint but require separate rendering, accessibility, and RTL testing. Native builds do not prove native runtime correctness; all six release targets require verification.
