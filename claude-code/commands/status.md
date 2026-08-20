---
description: "Derive and print every cook task set's status and open tasks. Read-only: no verifier spawn, no state change."
---

Read `${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/references/status.md` and
apply it to every set directory under `.cook/tasks/`.

This command is **read-only and side-effect-free**: derive each set's status
from its files, print one line per set (set id, derived status, verification
mark in the terminal zone — including `verified at <sha>` when HEAD has moved
past the verified SHA), then list each set's open tasks. Where a review
document exists, print the review pointer (path, commit written against,
out-of-date flag) — never the review body.

Do not run the Verifier, do not spawn anything, do not write any file. A
cache miss displays as NEEDS-VERIFY; deciding to verify belongs to `/cook`.
