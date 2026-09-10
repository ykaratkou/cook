# Delivery note: pi

The pi half of ADR-0006: every capability the cook skills name, mapped to
this host's concrete mechanism. Skill text names capabilities only; this
note is the single place pi mechanics appear. Capability names follow the
matrix in `docs/spec/10-hosts.md`; the mechanisms are written to that
spec's contract.

Two packages supply them. Subagent spawn comes from
**`@tintinweb/pi-subagents`**, a prerequisite cook does not author and does
not wrap (ADR-0011); everything else comes from **cook's own pi extension**
(`cook_gate`, the six commands) or from pi's built-in tools.

| Capability | Mechanism on pi |
| --- | --- |
| **Fresh-context subagent spawn** | The **`Agent` tool from `@tintinweb/pi-subagents`** — not a cook tool, and not wrapped by one. Call it with exactly `subagent_type: "general-purpose"`, `isolated: true`, `run_in_background: false`, `prompt` set to the rendered prompt verbatim, and a 3–5 word `description` naming the run (`cook attempt T-003`, `cook verifier`, `cook reviewer`). **Both flags are load-bearing.** `isolated: true` is the seal: it strips every extension and skill from the child, so an Attempt can reach neither `cook_gate` nor cook's commands, and the host suppresses AGENTS.md / CLAUDE.md for every subagent regardless — the child sees cook's prompt and the repo, nothing else. `run_in_background: false` is what returns the run's output inline; the default (`true`) returns an agent id instead, which is not output and must never be parsed as one. Pass no `model` (the child inherits the session default) and no `max_turns` (turn cap is Blind here — see the footer). |
| **Subagent output capture** | The tool result is **host-framed**, not the bare reply. A completed run reads: one header line — `Agent completed in <duration> (<n> tool uses, …)` — then a blank line, then the subagent's final message verbatim. **The reply is everything after that blank line.** Read it, and only it, wherever cook's core says *the reply* — so a Verifier's `VERDICT:` is the first line **of the reply**, not of the tool result, and an Attempt's `TASK_COMPLETE` is still the last line of both. Three shapes are not a reply at all: text opening `Agent failed:` is a failed run (the error, plus any partial output the run salvaged, follows); a header ending `(STOPPED BY THE USER …)` or `(aborted at the turn limit …)` marks the work unfinished, so treat it as a failed attempt whatever the body says; a body of `No output.` is `empty-output`. A spawn that throws before the child runs consumes no attempt. No shared conversation state; the subagent is never spoken to again. |
| **Structured gate ask** | The `cook_gate` tool: `{ kind: select \| confirm \| input, title, options?, message?, placeholder? }`, with the gate's (or confirmation's) allowed outcomes as the options. An **error result means the session has no UI** — gates are attended-only (ADR-0004): park the set and exit. Never treat an error result as an answer. |
| **The shared prompts directory** | The absolute path the cook command message carries — the extension resolves and injects it at invocation. Never a guessed or hardcoded path. |
| **Session identifier for `drain.lock`** | The session id the cook command message's trailer carries (`session identifier for drain.lock: …`, injected by the extension), verbatim. It is also the loop-hardening's scoping key: the `agent_settled` hardening nags only the session whose id the lock records. Fall back to a fresh random token only when no trailer id exists — that forfeits hardening for the drain, nothing else. |
| **Interrupt observation** | The human's interrupt stops the running `Agent` call. You observe it either as a cancelled tool call or as a result whose header ends `(STOPPED BY THE USER — everything the agent produced is above; the task is unfinished)`. Both are the Interrupt gate's trigger, and the task stays open under either. |
| **Cook-state read and mutation** | pi's built-in `read`, `edit`, and `write` tools — no cook extension involved. `read` for every file you are about to reason over; `edit` for targeted replacements inside an existing file, taking **several disjoint `{ oldText, newText }` replacements in one call** (`{ path, edits: [ … ] }`), which is how two facts that must land together land in one write; `write` for a file you are creating whole (a new `drain.lock`, a review document). **`edit` requires the file to have been read first** — each `oldText` must match the file's current bytes exactly and be unique in it, which you cannot supply without having read the file; that prior read is the stale-read guard ground rule 1 already asks for. Writes are in place; there is no rename-over-target, so satisfy ground rule 4 by making the transition one call, not by authoring a program that stages a temporary file. |
| **RFC3339 UTC timestamps** | `date -u +%Y-%m-%dT%H:%M:%SZ` through the built-in `bash` tool — for `drain.lock`, `progress.txt` blocks, and review filenames. One shell call, identical to claude-code's; never compute a timestamp by reasoning or reach for an interpreter's date library. |

Blind on this host in v1 (never emit or fabricate a bound you cannot
enforce): per-spawn turn cap, timeout kill — see the capability matrix in
`docs/spec/10-hosts.md`. The `Agent` tool does take a `max_turns`, which is
why the spawn row forbids passing one: v1 keeps the turn cap Blind on both
hosts, and a bound emitted here would be a bound cook's core cannot reason
about.
