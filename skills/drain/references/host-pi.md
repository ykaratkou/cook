# Delivery note: pi

The pi half of ADR-0006: every capability the cook skills name, mapped to
this host's concrete mechanism — the tools cook's pi extension registers.
Skill text names capabilities only; this note is the single place pi
mechanics appear. Capability names follow the matrix in
`docs/spec/10-hosts.md`; the mechanisms are written to that spec's contract.

| Capability | Mechanism on pi |
| --- | --- |
| **Fresh-context subagent spawn** | The `cook_subagent` tool, parameters `{ prompt }` — the rendered prompt verbatim. The extension runs a sealed child `pi` process and delivers the prompt on stdin; a prompt never rides a command line. |
| **Subagent output capture** | The tool's result text is the run's entire output (the child's final assistant message); the tool details carry stopReason, usage, exit code, and a stderr tail, plus the run's Subagent trace and the path it was written to — those are for the human to read, never for you to parse: the result text stays the only output you read. A child failure (non-zero exit, error/aborted stop) is an error result; a spawn that errors before the child runs consumes no attempt. No shared conversation state; the subagent is never spoken to again. |
| **Structured gate ask** | The `cook_gate` tool: `{ kind: select \| confirm \| input, title, options?, message?, placeholder? }`, with the gate's (or confirmation's) allowed outcomes as the options. An **error result means the session has no UI** — gates are attended-only (ADR-0004): park the set and exit. Never treat an error result as an answer. |
| **The shared prompts directory** | The absolute path the cook command message carries — the extension resolves and injects it at invocation. Never a guessed or hardcoded path. |
| **Session identifier for `drain.lock`** | The session id the cook command message's trailer carries (`session identifier for drain.lock: …`, injected by the extension), verbatim. It is also the loop-hardening's scoping key: the `agent_settled` hardening nags only the session whose id the lock records. Fall back to a fresh random token only when no trailer id exists — that forfeits hardening for the drain, nothing else. |
| **Interrupt observation** | The human's interrupt aborts the running `cook_subagent` child; you observe the aborted call's error result. |
| **Cook-state read and mutation** | pi's built-in `read`, `edit`, and `write` tools — no cook extension involved. `read` for every file you are about to reason over; `edit` for targeted replacements inside an existing file, taking **several disjoint `{ oldText, newText }` replacements in one call** (`{ path, edits: [ … ] }`), which is how two facts that must land together land in one write; `write` for a file you are creating whole (a new `drain.lock`, a review document). **`edit` requires the file to have been read first** — each `oldText` must match the file's current bytes exactly and be unique in it, which you cannot supply without having read the file; that prior read is the stale-read guard ground rule 1 already asks for. Writes are in place; there is no rename-over-target, so satisfy ground rule 4 by making the transition one call, not by authoring a program that stages a temporary file. |
| **RFC3339 UTC timestamps** | `date -u +%Y-%m-%dT%H:%M:%SZ` through the built-in `bash` tool — for `drain.lock`, `progress.txt` blocks, and review filenames. One shell call, identical to claude-code's; never compute a timestamp by reasoning or reach for an interpreter's date library. |

Blind on this host in v1 (never emit or fabricate a bound you cannot
enforce): per-spawn turn cap, timeout kill — see the capability matrix in
`docs/spec/10-hosts.md`.
