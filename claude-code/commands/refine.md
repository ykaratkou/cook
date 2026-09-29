---
description: "Force a cook Refine pass on a task set now, outside the automatic flow. The Refiner fixes in place what the implementation convention licenses; cook commits the fixes and writes a fresh Refine report."
argument-hint: <set-id>
---

Read `${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/references/refine.md` and
run its **force mode** for the named set: take `drain.lock` (refuse on a fresh
lock), run one full Refine pass regardless of the `refine` setting and the
Refine episode, and remove the lock on every exit path. Refine gates nothing;
report the outcome, the Refine commit made (if any), and the Refine pointer
(path, commit, out-of-date flag) — never inline the report body. Prompt
rendering rules and the lock procedure are in
`${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/SKILL.md`.

Set to refine: $ARGUMENTS
