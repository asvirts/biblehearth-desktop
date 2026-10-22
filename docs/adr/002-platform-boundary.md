# ADR 002: Platform supplies online Scripture

Status: accepted.

Use the published YouVersion React UI and JavaScript SDKs for licensed catalog access, reading, and search. Keep provider objects outside local persistence and backups. Disable provider authentication and supply controlled local highlights from the first mount. Preserve attribution, fonts, and text direction. Public frontend app keys are configuration, not protected secrets. Do not persist Scripture for offline use without a separately approved capability and content agreement. Network failure must leave personal data usable.
