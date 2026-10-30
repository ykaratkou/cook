---
description: "Force a cook Refine pass on a task set now, outside the automatic flow. The Refiner fixes in place what the implementation convention licenses; cook commits the fixes and writes a fresh Refine report."
---

Read `${COOK_ROOT}/skills/drain/references/refine.md` and run its **force
mode** for the named set: take `drain.lock` (refuse on a fresh lock), run one
full Refine pass regardless of the `refine` setting and the Refine episode,
and remove the lock on every exit path. Refine gates nothing; report the
outcome, the Refine commit made (if any), and the Refine pointer (path,
commit, out-of-date flag) — never inline the report body. Prompt rendering
rules and the lock procedure are in `${COOK_ROOT}/skills/drain/SKILL.md`.

Your host's delivery note is
`${COOK_ROOT}/skills/drain/references/host-opencode.md` (opencode); apply it
wherever the skill names a capability.

Set to refine: $ARGUMENTS
