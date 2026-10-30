---
description: "Author a cook task set for a feature: interview (grill), spec, decompose into tickets, then self-validate until the set derives READY."
argument-hint: <feature>
---

Read `${CLAUDE_PLUGIN_ROOT}/claude-code/skills/plan/SKILL.md` in full and
follow it. It orchestrates the companion skills (grill-with-docs → to-spec →
to-tickets) and self-validates the resulting task set against the format
contract until it derives READY.

Your host's delivery note is
`${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/references/host-claude-code.md`
(Claude Code); apply it wherever the skill names a capability.

Feature to plan: $ARGUMENTS
