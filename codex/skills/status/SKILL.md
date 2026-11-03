---
name: status
description: Explicitly show Cook task-set statuses, marks, report pointers, and open tasks. Read-only; never spawns agents or changes state.
---

Read `../../../skills/drain/references/host-codex.md` relative to this file
and apply it throughout. Read `../../../skills/drain/references/status.md`
and derive the status of every set under `.cook/tasks/`.

Print one line per set with its id, status, verification mark in the terminal
zone (including `verified at <sha>` when HEAD has moved), and Refine mark;
then list open tasks. Show existing Refine pointers (path, commit,
out-of-date flag) and Verify pointers (path, commit), never report bodies.
Do not spawn anything or write any file. A cache miss is NEEDS-VERIFY;
deciding to verify belongs to `$cook:drain`.
