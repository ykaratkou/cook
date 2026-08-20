---
description: "Force the cook Verifier on a task set now, outside the automatic flow. Ignores any cached verdict."
argument-hint: <set-id>
---

Read `${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/references/verify.md` and
run its **force mode** for the named set: always spawn a fresh Verifier,
regardless of any cached verdict (the cache governs only automatic runs).
Record and report the verdict per that document. Prompt rendering rules are
in `${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/SKILL.md`.

Set to verify: $ARGUMENTS
