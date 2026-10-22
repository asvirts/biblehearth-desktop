# Privacy

BibleHearth keeps personal annotations and preferences in the application's local data directory. It does not offer accounts, cloud synchronization, advertising, or analytics. Exported backups are readable personal data: store them privately. Uninstalling may leave application data behind; remove the app data directory only after exporting anything you want to keep.

Fetching Scripture, catalog entries, search results, and Verse of the Day sends network requests to YouVersion Platform. That provider necessarily receives request information (including network address and requested content); its own terms and privacy policy apply. Release checks contact GitHub. No offline Scripture database is included.

Optional error reporting must be off until explicit consent. The only permitted destination is the owner's personal Sentry project. Withdrawal stops further reporting; it does not erase previously submitted events. Replay and performance tracking are disabled. Reports must exclude notes, Scripture, searches, credentials, user-identifying paths, and request bodies/headers. Do not enable diagnostics in a public release until both frontend and Rust controlled-error tests demonstrate redaction and consent behavior. If no approved personal project is configured, reporting remains unavailable.

Never attach your database, backups, keys, or personal notes to a public issue. See [support](SUPPORT.md).
