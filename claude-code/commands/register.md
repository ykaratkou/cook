---
description: "Validate a hand-authored or hand-edited cook task set against the format contract; print the fix list, or READY."
argument-hint: <set-id>
---

Read `${CLAUDE_PLUGIN_ROOT}/claude-code/skills/register/SKILL.md` in full and
follow it. Validate the named set against the format contract and report
either READY or the ordered fix list. Registration never drains and never
edits task state on its own.

Your host's delivery note is
`${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/references/host-claude-code.md`
(Claude Code); apply it wherever the skill names a capability.

Set to validate: $ARGUMENTS
