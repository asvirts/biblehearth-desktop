# ADR 003: Local ownership of personal data

Status: accepted.

SQLite is the desktop source of truth for notes, highlights, bookmarks, preferences, and reading position. Every passage annotation includes its version ID and canonical reference. Stable record IDs and revision timestamps support transactional, validated, repeatable JSON imports. Preserve distinct note text during conflict merging rather than silently discarding either copy. There are no accounts or cloud synchronization. Flush edits before navigation and application-controlled restart; expose save failures. Database schema and backup format are versioned independently.
