---
description: "Wayfinding: chart a Map of decision tickets for work too big for one session, work its tickets, assist, or hand it off to one task set."
argument-hint: "[<idea> | <map-id> [NN | assist | handoff]]"
---

Read `${CLAUDE_PLUGIN_ROOT}/claude-code/skills/map/SKILL.md` in full and
follow it. It dispatches on the argument: none lists the Maps, an existing
map id works its next ticket (or the named one), `assist` and `handoff` are
the other two modes, and anything else charts a new Map from that idea.

Your host's delivery note is
`${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/references/host-claude-code.md`
(Claude Code); apply it wherever the skill names a capability.

Argument: $ARGUMENTS
