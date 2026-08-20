# Delivery note: pi

The pi half of ADR-0006: every capability the cook skills name, mapped to
this host's concrete mechanism — the tools cook's pi extension registers.
Skill text names capabilities only; this note is the single place pi
mechanics appear. Capability names follow the matrix in
`docs/spec/10-hosts.md`; the mechanisms are written to that spec's contract.

| Capability | Mechanism on pi |
| --- | --- |
| **Fresh-context subagent spawn** | The `cook_subagent` tool, parameters `{ prompt }` — the rendered prompt verbatim. The extension runs a sealed child `pi` process and delivers the prompt on stdin; a prompt never rides a command line. |
| **Subagent output capture** | The tool's result text is the run's entire output (the child's final assistant message); the tool details carry stopReason, usage, exit code, and a stderr tail. A child failure (non-zero exit, error/aborted stop) is an error result; a spawn that errors before the child runs consumes no attempt. No shared conversation state; the subagent is never spoken to again. |
| **Structured gate ask** | The `cook_gate` tool: `{ kind: select \| confirm \| input, title, options?, message?, placeholder? }`, with the gate's (or confirmation's) allowed outcomes as the options. An **error result means the session has no UI** — gates are attended-only (ADR-0004): park the set and exit. Never treat an error result as an answer. |
| **The shared prompts directory** | The absolute path the cook command message carries — the extension resolves and injects it at invocation. Never a guessed or hardcoded path. |
| **Session identifier for `drain.lock`** | The best handle the session gives you: the session identifier the cook command message or environment provides when there is one, else a fresh random token. |
| **Interrupt observation** | The human's interrupt aborts the running `cook_subagent` child; you observe the aborted call's error result. |

Blind on this host in v1 (never emit or fabricate a bound you cannot
enforce): per-spawn turn cap, timeout kill — see the capability matrix in
`docs/spec/10-hosts.md`.
