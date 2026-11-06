# Skill update-context

Leaves memory up to date and shorter than it was at the start.

## When to run it

- When closing an important session. A session is important if product code changed, a decision was made, a new problem was found, or a release changed state.
- Not after every message. Not after a read-only or question-only session.

## What to update

Go through this order and touch only what changed.

1. [state/status.md](../state/status.md). Overwrite the Done, Pending, and Blockers sections with the current state. Move finished work to Done. Remove pending items that no longer apply. Update the date.
2. [decisions/decisions.md](../decisions/decisions.md). Add one entry per new decision with date, decision, reason, and a link to the evidence (commit, PR, or ADR). If the decision deserves a formal ADR, create `docs/adr/00N-*.md` and leave only the link here. If an earlier decision was reverted, mark it as superseded.
3. [gotchas/gotchas.md](../gotchas/gotchas.md). Add a new problem with symptom, cause, and fix. Remove the ones that no longer reproduce.
4. `logs/YYYY-MM-DD-topic.md`. A new file with what was done, what was learned, and what is still open. At most 40 lines. Link commits instead of pasting diffs. Format in [logs/README.md](../logs/README.md).
5. [rules.md](../rules.md). Only if a red line changed. Every new rule must be violable and detectable. If a command can check it, add the check to `skills/check-context.sh`.
6. [AGENTS.md](../AGENTS.md). Only if the identity, reading order, map, or Definition of Done changed.

## How to keep it lean

- Compress the old. If `logs/` has more than 10 session logs, merge the oldest into a single `logs/YYYY-MM-summary.md` of at most 40 lines and delete the originals.
- Delete what no longer helps. Closed pending items, solved gotchas, paths that no longer exist.
- Do not copy history into the prompt or into memory. Link the commit, the PR, or the file.
- Do not duplicate. If a fact lives in `docs/`, `GLOSSARY.md`, or an ADR, link it.
- Do not let AGENTS.md exceed 300 lines. If it grows, move detail to the matching folder and leave a link.

## Closing

1. Run `bash skills/check-context.sh`. It must finish with `OK`.
2. Compare the total memory line count before and after with `wc -l AGENTS.md rules.md state/*.md decisions/*.md gotchas/*.md logs/*.md`. Not counting the new log or new `decisions/` entries, the total must not grow.
3. Commit only the memory files, with a message like `Update agent memory after <topic>`.

Expected result. Context up to date and shorter than at the start.
