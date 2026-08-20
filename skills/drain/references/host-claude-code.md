# Delivery note: claude-code

The claude-code half of ADR-0006: every capability the cook skills name,
mapped to this host's concrete mechanism. Skill text names capabilities only;
this note is the single place claude-code mechanics appear. Capability names
follow the matrix in `docs/spec/10-hosts.md`.

| Capability | Mechanism on claude-code |
| --- | --- |
| **Fresh-context subagent spawn** | One Agent tool call with `subagent_type: "general-purpose"`. The rendered prompt is the spawn's task text (the tool's prompt parameter) — never a command line. |
| **Subagent output capture** | The Agent tool call's return value is the run's entire output; parse it for sentinels / VERDICT / the review document. No shared conversation state; the subagent is never spoken to again. |
| **Structured gate ask** | AskUserQuestion, with the gate's (or confirmation's) allowed outcomes as the options. |
| **The shared prompts directory** | `${CLAUDE_PLUGIN_ROOT}/prompts/` (the plugin root is the cook repo root). |
| **Session identifier for `drain.lock`** | The best handle the session gives you: the Claude Code session id when you know it, else a PID-like handle, else a fresh random token. |
| **Interrupt observation** | The human's Esc cancels the running tool call; you observe the cancelled Agent tool spawn. |

Blind on this host (never emit or fabricate a bound you cannot enforce):
per-spawn turn cap, timeout kill — see the capability matrix in
`docs/spec/10-hosts.md`.
