# Release verification

Record version, full commit, artifact SHA-256, tester, OS version, native CPU, and receipt for every run. Build success alone never passes a runtime check. Exercise each of the six target architectures on actual native hardware or a native-architecture VM.

Required evidence `checks` on each target:

| Key | Required scenario |
|---|---|
| `install` | Install correct artifact; launch without development tooling; validate OS signature where applicable. |
| `read` | Licensed catalog and John 1 load with attribution; change version/chapter; unavailable/denied/network errors offer recovery. |
| `search` | Search and open a result in the correct version; empty/error/offline states behave correctly. |
| `annotate` | Select without auto-saving; create highlight, bookmark, and multiple notes; save status is accurate. |
| `restart` | Restart preserves preferences, notes, and reading position; navigation flushes pending note edits. |
| `backup` | Export contains references and personal content, no copied Scripture or credentials. |
| `import` | Invalid/future backup fails before mutation; repeated import is idempotent; conflicting notes preserve text; unrelated records survive. |
| `rtl` | Arabic UI and RTL Scripture independently render correctly; mixed direction, selection, fonts, zoom work. |
| `accessibility` | Keyboard-only flow, focus, labels, screen reader, contrast, reduced motion, light/dark/system themes. |
| `update` | Check automatically/manually; consent before download/install; signed old-to-new update succeeds. |
| `invalidSignature` | Tampered artifact/signature is rejected without replacing working installation. |
| `interruptedDownload` | Interrupted download recovers and leaves installation/data intact. |
| `dataPreserved` | Upgrades preserve database and pending edits; a failed save prevents controlled restart. |

Linux additionally requires `x11`, `wayland`, and `debianPackage`: test both display sessions; install a Debian package; verify that its update action offers the matching package, never AppImage replacement.

Release-level gates must include content-license/identity review, Apple notarization and Windows signature inspection, updater signing, and, only when diagnostics are enabled, frontend/Rust consent-redaction receipts in the owner's personal Sentry project. Sentry is deferred for the current release; verify no telemetry requests with empty DSNs. Test no consent, consent granted, and consent withdrawn; no replay/performance/user content may be captured. Review English, Spanish, Portuguese, Arabic, and Chinese manually and record the accepted quality risk for the other generated locales.
