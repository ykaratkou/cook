---
status: accepted
date: 2026-08-20
---

# Markdown skills are the portable core

> **Superseded on one point** (2026-08-20, by ADR-0007): the command-surface
> paragraph below — "`/cook` resolves unnamespaced on both hosts" — no longer
> holds. Claude Code plugins cannot claim a bare name, and pi's commands are
> extension-registered rather than filename-named prompt templates; both
> hosts ship the identical namespaced verb set (`/cook:drain`, `/cook:plan`,
> `/cook:register`, `/cook:status`, `/cook:verify`, `/cook:review`) and no
> bare `/cook`. The rest of this ADR stands.

Both target hosts implement the agentskills.io standard — Claude Code
natively, and pi-coding-agent (verified against v0.84.2 and its shipped docs)
discovers `SKILL.md` packages from `.agents/skills/` and even reuses
`~/.claude/skills`. We decided cook's core is therefore **host-neutral
markdown**: the drain-orchestration skills plus one shared `prompts/`
directory (file-per-prompt, pop's filenames kept), identical bytes on every
host. Per-host adapters stay thin and are the only host-specific code.

- **Claude Code**: no adapter needed — the built-in Agent tool provides
  fresh-context subagent spawn, and AskUserQuestion provides structured gates.
- **Pi**: has no built-in subagent, but ships a first-party subagent extension
  pattern (`examples/extensions/subagent/`, published as `pi-subagents`) that
  spawns fresh `pi --mode json -p` subprocesses with isolated context. Cook's
  Pi adapter is one TypeScript extension file wrapping that pattern; gates use
  `ctx.ui.select`.

The "no extra dependencies" goal is amended accordingly: *no dependencies
beyond one first-party extension per host that lacks subagent spawn*.

Command surface (host mapping in `docs/spec/10-hosts.md`): `/cook` (the
drain), `/cook:plan`, `/cook:register`, `/cook:status`, `/cook:verify`,
`/cook:review`. `/cook` resolves unnamespaced on both hosts — Claude Code
resolves an unambiguous plugin command without its namespace, and Pi commands
are filename-named.

## Considered Options

- **Per-host native implementations** (TS extension on Pi doing everything,
  hooks-heavy Claude Code plugin). Rejected: duplicates the orchestration
  logic per host, and every pop port would have to land N times. With
  markdown as the core, a ported prompt or flow change lands once.
- **Shared TypeScript core embedded per host.** Rejected for v1: Pi could
  host it in-process but Claude Code could not without a subprocess boundary,
  which reintroduces the external-binary shape ADR-0001 rejected.

## Sources in pop

- pop `CONTEXT.md`: **Agent preset**, **Agent adapter** (the per-host seam
  cook's adapters mirror)
- Pi facts: `/opt/homebrew/Cellar/pi-coding-agent/0.84.2/...` shipped docs
  (`extensions.md`, `skills.md`, `prompt-templates.md`) and
  `examples/extensions/subagent/`; github.com/earendil-works/pi
