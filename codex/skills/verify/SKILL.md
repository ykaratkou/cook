---
name: verify
description: Explicitly force Cook verification of a named task set, ignoring cached verdicts; a non-PASS verdict opens the human Verify-failed gate.
---

Read `../../../skills/drain/references/host-codex.md` relative to this file
and apply it throughout. Read `../../../skills/drain/references/verify.md`
and run its **force mode** for the set named after `$cook:verify`: always
spawn a fresh Verifier regardless of cached verdicts, record the verdict,
and file the Verify report, enacting nothing. A non-PASS verdict opens the
Verify-failed gate in `../../../skills/drain/references/gates.md`.
Read `../../../skills/drain/SKILL.md` for the prompt rendering rules.
