---
description: "Force the cook Verifier on a task set now, outside the automatic flow. Ignores any cached verdict; a non-PASS verdict ends at the Verify-failed gate."
---

Read `${COOK_ROOT}/skills/drain/references/verify.md` and run its **force
mode** for the named set: take `drain.lock` (refuse on a fresh lock), always
spawn a fresh Verifier regardless of any cached verdict (the cache governs
only automatic runs), record the verdict and file the Verify report —
enacting nothing — then remove the lock. A non-PASS verdict opens the
Verify-failed gate per `${COOK_ROOT}/skills/drain/references/gates.md`.
Prompt rendering rules and the lock procedure are in
`${COOK_ROOT}/skills/drain/SKILL.md`.

Your host's delivery note is
`${COOK_ROOT}/skills/drain/references/host-opencode.md` (opencode); apply it
wherever the skill names a capability.

Set to verify: $ARGUMENTS
