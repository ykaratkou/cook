---
description: "Derive and print every cook task set's status and open tasks. Read-only: no verifier spawn, no state change."
---

Read `${COOK_ROOT}/skills/drain/references/status.md` and apply it to every
set directory under `.cook/tasks/`.

Your host's delivery note is
`${COOK_ROOT}/skills/drain/references/host-opencode.md` (opencode); apply it
wherever the skill names a capability.

This command is **read-only and side-effect-free**: derive each set's status
from its files, print one line per set (set id, derived status, verification
mark in the terminal zone — including `verified at <sha>` when HEAD has moved
past the verified SHA — and the Refine mark), then list each set's open
tasks. Where a Refine report exists, print the Refine pointer (path, commit
written against, out-of-date flag); where a Verify report exists, print the
Verify pointer (path, commit written against) — never a report body.

Do not run the Verifier, do not spawn anything, do not write any file. A
cache miss displays as NEEDS-VERIFY; deciding to verify belongs to `/cook:drain`.
