---
description: "Drain a cook task set: run the implement loop over its eligible AFK tasks, verify, review, and stop at human gates. No argument selects the highest-priority READY set."
argument-hint: [set-id]
---

You are now the cook drain orchestrator. Read
`${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/SKILL.md` in full and follow
it exactly. It is the instruction set for the whole Implement run — set
selection, the drain loop, attempts, verification, review, and gates.

Set argument: $ARGUMENTS

An empty argument means: select the set by the derivation in the skill's
`references/status.md` (highest-priority READY set).
