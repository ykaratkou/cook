---
status: accepted
date: 2026-08-20
---

# Skills name capabilities; hosts supply delivery notes

ADR-0003 made the skills host-neutral markdown, but the first shipped
versions (claude-code plugin, 2026-08-20) drifted: the drain skill hardcodes
claude-code delivery — `${CLAUDE_PLUGIN_ROOT}/prompts/`, the Agent tool with
`subagent_type: "general-purpose"`, AskUserQuestion. Shared "as the same
files" (spec 10-hosts) those passages would be wrong on pi.

We decided the skill text names the **capability**, never the host mechanism:
"spawn a fresh-context subagent", "open the gate's structured ask", "the
shared prompts directory". Each host contributes one small **delivery note**
— a reference file per host (`references/host-claude-code.md`,
`references/host-pi.md`) mapping every named capability to its concrete
mechanism (tool name, invocation shape, prompts path). The skill points at
the note once; the orchestrator reads its own host's note and applies it.
The capability names are the ones `docs/spec/10-hosts.md`'s matrix declares —
the note is the matrix row made operational.

Adding a host is then: write one delivery note, wire commands. No skill fork.

## Considered Options

- **Fork the skills per host.** Rejected: two copies of the orchestration
  text, every pop port lands twice — exactly the translation tax the
  vocabulary rule exists to avoid.
- **Keep claude-code text canonical, overlay a pi mapping doc** ("where it
  says Agent tool, use the extension's spawn tool"). Rejected: the pi
  orchestrator must mentally rewrite the instructions while following them;
  misread risk lands on the host with the weakest test coverage.

## Sources in pop

- pop `CONTEXT.md`: **Agent adapter** — the capability/mechanism seam this
  ports; `docs/adr/0165`, `0166` (capability declaration seams).
- User decision at the pi-plugin grill (2026-08-20), Q2.
