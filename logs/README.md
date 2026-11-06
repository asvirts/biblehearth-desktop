# Logs

Compressed summaries of important sessions. History, not instructions. Read a log only when `state/` points to it.

- One file per important session, named `YYYY-MM-DD-topic.md`.
- At most 40 lines. `bash skills/check-context.sh` fails on longer logs.
- Sections: what was done, what was learned, what is still open.
- Link commits and PRs instead of pasting diffs or history.
- When there are more than 10 session logs, merge the oldest into one `YYYY-MM-summary.md` of at most 40 lines and delete the originals.
