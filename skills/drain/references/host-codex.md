# Delivery note: Codex

Use this note for every Cook capability on Codex. The plugin root is three
directories above an entry skill's directory (`codex/skills/<verb>/`),
or three directories above this note's directory (`skills/drain/references/`).
Resolve it from the installed file path, never the target checkout's cwd.
Shared skill references resolve relative to the shared file being read.
`.cook/` always belongs to the target checkout, not the plugin installation.

Cook's `/cook:<verb>` notation in shared text means `$cook:<verb>` on this
host. The seven entry skills are explicit-only. Load companion skills from
`<cook-root>/skills/<name>/SKILL.md`; do not substitute unrelated installed
skills or interpret shared command spellings as shell commands.

`$cook:plan` and `$cook:map` stop in plain text, never through
`request_user_input`, and end each such turn with the shared skill's
`Cook-Stop: <kind>` line exactly as its "Stops" section says (ADR-0019).

| Capability | Mechanism on Codex |
| --- | --- |
| **Fresh-context subagent spawn** | `spawn_agent` with the rendered prompt as `message`, `agent_type: "default"`, and `fork_context: false`. Never fork the conversation or resume a prior agent. Use the same checkout; Attempts and Refiner need write permissions. If spawn tools are unavailable, stop and report the missing capability rather than implement in the parent. |
| **Subagent output capture** | Keep the returned agent id and use `wait` until it reports a terminal status. A wait timeout means still running, not a failed Attempt. Parse only the completed agent's final output for sentinels / VERDICT / REFINE-OUTCOME and reports. Close the completed agent with `close_agent` to release its slot. Never send follow-up work to it; the next Attempt is a new spawn. |
| **Structured gate ask** | Use `request_user_input` when available, with the gate's allowed outcomes. When unavailable in the current mode, present those same choices in the conversation and end the turn awaiting the human's explicit answer. In non-interactive execution, park and exit without a disposition. No answer or a dismissed ask is never consent. |
| **The shared prompts directory** | `<cook-root>/prompts/`. |
| **The shipped conventions directory** | `<cook-root>/conventions/`. |
| **Interrupt observation** | Only an explicit interrupted/cancelled agent result is an interrupt. A parent turn ending or a `wait` timeout is not evidence the child stopped. Reconcile any known live child before another write-capable spawn; never run two Attempts for the same task concurrently. |
| **Cook-state read and mutation** | Read through the shell (`cat`, `sed`) or an available file-read tool; make targeted edits and new files with `apply_patch`. Read each state file immediately before reasoning over or editing it. One patch per file transition, no improvised state-rewriting program. Writes are in place. |
| **RFC3339 UTC timestamps** | `date -u +%Y-%m-%dT%H:%M:%SZ` through the shell tool. |

Turn-cap enforcement and timeout kill are **Blind**: no Cook per-spawn bound
is enforced. `wait`'s timeout bounds waiting, not the child. Do not use
`close_agent` as an automatic deadline or classify it as turn-cap exhaustion.
Subagent threads are **Human-facing** traces; Cook never reads them to derive
state. Host error/not-found results are infrastructure failures, not successful
task output; apply the shared crash/assessment rules.
