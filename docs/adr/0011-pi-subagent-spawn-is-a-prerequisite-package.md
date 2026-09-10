---
status: accepted
date: 2026-09-10
---

# On pi, subagent spawn is a prerequisite package, not cook's code

Pi has no built-in subagent, so cook's pi adapter grew one. `cook_subagent`
spawned a sealed child `pi --mode json -p` process, delivered the prompt on
stdin, parsed the JSONL stream for the final assistant message, and — because
a child process has no host-native view the way Claude Code's `/tasks` has —
also accumulated a bounded step list, streamed it through the tool-update
callback, drew two TUI renderers for it, teed the raw stream to a trace file
under pi's agent dir, and pruned traces older than fourteen days.

That was about seven hundred of the extension's eleven hundred lines, and
none of it was cook. It was a subagent runtime, maintained by a project whose
subject is task sets.

`@tintinweb/pi-subagents` is that runtime, maintained as its own thing: an
`Agent` tool, a live widget, FleetView, per-run transcripts, agent types,
concurrency, steering. Its `isolated: true` reproduces the seal cook was
assembling by hand — extensions and skills stripped from the child, and pi
suppresses AGENTS.md / CLAUDE.md for every subagent regardless — and its
`run_in_background: false` returns the run's output inline.

We decided **cook writes no subagent spawn code on pi**. The package is a
prerequisite (`pi install @tintinweb/pi-subagents`), and cook's skills name
its `Agent` tool directly in the pi delivery note. Cook's extension keeps only
what that package does not supply: `cook_gate`, the six commands, the optional
`agent_settled` hardening, and a probe that warns when the prerequisite is
absent.

## Consequences

**The pi delivery note names another project's tool.** ADR-0006 says skills
name capabilities and delivery notes name mechanisms; it never said the
mechanism had to be cook's. The note now says which package supplies each row.

**The result is host-framed, and the note says so.** A foreground `Agent`
result is a stats header, a blank line, then the subagent's reply. Cook's core
says a Verifier's `VERDICT:` is the reply's first line — still true, and the
delivery note is where "the reply" is pinned to the text after that blank
line. The core is untouched, which is the arrangement ADR-0006 exists to make
possible. The note also maps the three shapes that are not a reply:
`Agent failed:`, a `STOPPED BY THE USER` / `aborted at the turn limit` header,
and `No output.`

**Two matrix rows move, in opposite directions.** Turn cap enforcement becomes
*Blind in v1, Supported-capable* on pi — the `Agent` tool takes `max_turns` —
and the delivery note forbids passing one, keeping v1 symmetric with
claude-code. Timeout kill becomes plainly **Blind**: cook no longer owns a
child process, so it has no timer to hang a kill on. Pi was the host that
could do what claude-code could not; it has traded that for not maintaining a
runtime.

**A missing prerequisite is a warning, not a failure.** `/cook:status` and
`/cook:register` spawn nothing. The probe uses the package's own discovery
surface and treats an unanswered probe as "not available here", per that
package's guidance that a session which filtered it out is indistinguishable
from one where it is not installed.

## Considered Options

- **Keep `cook_subagent` as a thin wrapper over `subagents:rpc:spawn`.**
  Rejected: it preserves every skill and spec byte, which is its whole appeal,
  but it keeps cook in the spawn business — a tool to version, a result shape
  to translate, and a second name for a thing pi users already have a name
  for. The wrapper's only real gain is hiding the host framing, and a delivery
  note hides it for free.
- **Ship cook agent types (`cook-attempt.md`, `prompt_mode: replace`).** A
  truer seal than `general-purpose` + `isolated: true`, since the child would
  not inherit the parent's system prompt. Rejected for v1: a pi package
  manifest carries `extensions`, `skills`, `prompts`, and `themes` — there is
  no way to deliver an agent file, so it would cost every install a manual
  copy into `~/.pi/agent/agents/`. Revisit if pi packages learn to ship agent
  types. The residual divergence is ledgered in `PARITY.md`.
- **Bundle pi-subagents inside cook** (`dependencies` +
  `bundledDependencies`). Rejected: it makes a bare cook install work, but
  anyone who also installs the package normally — the common case, since it is
  useful on its own — loads it twice.
- **Keep the custom spawn and vendor nothing.** Rejected: the code was already
  more subagent runtime than cook, and the trace slice in particular existed
  only because no one else was providing the view.

## Sources

- `@tintinweb/pi-subagents` v0.19.0: `README.md` (the `Agent` tool, agent-type
  frontmatter, `isolated`, tool and extension scoping), `docs/rpc.md`
  (discovery, `subagents:ready`, the ping handshake, and the guidance that an
  unanswered probe means "not available here"), `src/agent-runner.ts`
  (AGENTS.md / CLAUDE.md suppression for every subagent),
  `src/status-note.ts` and `src/index.ts` (the foreground result framing).
- pi-coding-agent v0.84.2 `docs/packages.md` — the manifest's four resource
  keys, and the `bundledDependencies` route that was rejected.
- Cook ADR-0006 (skills name capabilities; hosts supply delivery notes),
  ADR-0009 (Human-facing declarations, which the trace rows keep).
- User decision, 2026-09-10: delete `cook_subagent` and call `Agent`
  directly; carry pi-subagents as a documented prerequisite.
