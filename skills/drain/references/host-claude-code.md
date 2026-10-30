# Delivery note: claude-code

The claude-code delivery note of ADR-0006: every capability the cook skills name,
mapped to this host's concrete mechanism. Skill text names capabilities only;
this note is the single place claude-code mechanics appear. Capability names
follow the matrix in `docs/spec/10-hosts.md`.

| Capability | Mechanism on claude-code |
| --- | --- |
| **Fresh-context subagent spawn** | One Agent tool call with `subagent_type: "general-purpose"`. The rendered prompt is the spawn's task text (the tool's prompt parameter) — never a command line. |
| **Subagent output capture** | The Agent tool call's return value is the run's entire output; parse it for sentinels / VERDICT / REFINE-OUTCOME and the report. No shared conversation state; the subagent is never spoken to again. |
| **Structured gate ask** | AskUserQuestion, with the gate's (or confirmation's) allowed outcomes as the options. |
| **The shared prompts directory** | `${CLAUDE_PLUGIN_ROOT}/prompts/` (the plugin root is the cook repo root). |
| **The shipped conventions directory** | `${CLAUDE_PLUGIN_ROOT}/conventions/` — the last rank of the convention stack (`refine.md`). |
| **Interrupt observation** | The human's Esc cancels the running tool call; you observe the cancelled Agent tool spawn. |
| **Cook-state read and mutation** | The `Read`, `Edit`, and `Write` tools. `Read` for every file you are about to reason over; `Edit` for a targeted replacement inside an existing file (`{ file_path, old_string, new_string }`); `Write` for a file you are creating whole (a Refine or Verify report). **`Edit` requires the file to have been read first in this session** — that prior read is the stale-read guard ground rule 1 already asks for. Writes are in place; there is no rename-over-target, so satisfy ground rule 4 by making the transition one call, not by staging a temporary file. |
| **RFC3339 UTC timestamps** | `date -u +%Y-%m-%dT%H:%M:%SZ` through the Bash tool — for `progress.txt` blocks and Refine and Verify report filenames. One shell call; never compute a timestamp by reasoning or by authoring a program. |

Blind on this host (never emit or fabricate a bound you cannot enforce):
per-spawn turn cap, timeout kill — see the capability matrix in
`docs/spec/10-hosts.md`.
