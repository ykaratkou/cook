# Delivery note: opencode

The opencode delivery note of ADR-0006: every capability the cook skills name,
mapped to this host's concrete mechanism. Skill text names capabilities only;
this note is the single place opencode mechanics appear. Capability names
follow the matrix in `docs/spec/10-hosts.md`.

| Capability | Mechanism on opencode |
| --- | --- |
| **Fresh-context subagent spawn** | One `subagent` tool call with `agent: "general"`, the rendered prompt as `prompt` (never a command line), and a short `description`. Never set `background`, and never pass a `sessionID` — that would continue an old child instead of starting a fresh one. |
| **Subagent output capture** | The text inside the `<subagent … state="completed">` wrapper is the run's entire output; parse it for sentinels / VERDICT / REFINE-OUTCOME and the report. A `Subagent cancelled` result is an interrupt (see Interrupt observation). A `Subagent failed` result is a crashed spawn. A "The subagent is working in the background" result means the human pushed the spawn to the background (Ctrl+B): it is **not an outcome** — never record it as one. Wait for the completion notification and parse its text exactly like a foreground result. No shared conversation state; the subagent is never spoken to again. |
| **Structured gate ask** | The `question` tool, with the gate's (or confirmation's) allowed outcomes as the options and a header of 30 characters or fewer. A "dismissed" error is **not an answer**: in headless `opencode run` it means attended-only (ADR-0004) — park the set and exit; never invent or default an outcome. |
| **The shared prompts directory** | The absolute prompts-directory path the cook command's trailer supplies. |
| **The shipped conventions directory** | The absolute conventions-directory path the cook command's trailer supplies — the last rank of the convention stack (`refine.md`). |
| **Session identifier for `drain.lock`** | The session id the cook command's trailer supplies (your real opencode session id). It is also the loop-hardening's scoping key: the plugin's idle hook acts only when the lock's `session` equals the idle session's id, and stays silent in every other session. |
| **Interrupt observation** | The human's Esc, pressed twice, interrupts; the running spawn returns `Subagent cancelled`. |
| **Cook-state read and mutation** | The `read`, `edit`, and `write` tools. `read` for every file you are about to reason over; `edit` for a targeted replacement inside an existing file (`{ path, oldString, newString }`); `write` for a file you are creating whole (`{ path, content }` — a new `drain.lock`, a Refine or Verify report). On models that opencode serves `patch` instead of `edit`/`write`, use `patch`. **opencode has no tool-enforced read-before-edit guard** (unlike Claude Code's `Edit`), so ground rule 1's prior read is your own discipline, not a tool check. Writes are in place; there is no rename-over-target, so satisfy ground rule 4 by making the transition one call, not by staging a temporary file. |
| **RFC3339 UTC timestamps** | `date -u +%Y-%m-%dT%H:%M:%SZ` through the `shell` tool — for `drain.lock`, `progress.txt` blocks, and Refine and Verify report filenames. One shell call; never compute a timestamp by reasoning or by authoring a program. |

Blind on this host (never emit or fabricate a bound you cannot enforce):
per-spawn turn cap (a per-agent `steps` cap exists, but a capped child reports
`completed` with a forced summary, so exhaustion is unrecognizable), timeout
kill (opencode has no subagent timeout) — see the capability matrix in
`docs/spec/10-hosts.md`.

Sources: opencode v2.0.20 (the installed binary) and the V2 docs,
https://opencode.ai/v2/docs/.
