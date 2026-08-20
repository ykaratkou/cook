---
status: accepted
date: 2026-08-20
---

# Cook runs inside the host agent

Pop is an external orchestrator: a standalone Go CLI that spawns agent CLIs as
headless subprocesses, parses their streams, and enforces every bound from
outside with a supervisor and SIGKILL. Cook inverts that shape: it is an
in-agent plugin. The human's own session in the host agent (Claude Code now,
Pi next) *is* the orchestrator — it follows the drain skill, selects tasks,
assesses results, and commits — while every implementation attempt, Verifier
run, and Reviewer run is a fresh-context subagent spawned by that session.
We chose this because an in-agent plugin is portable across agent ecosystems
without shipping or installing a separate binary, which is the whole point of
cook; an external port would gain nothing over just installing pop.

## Accepted costs

Three honest costs were weighed and accepted, each with its mitigation:

1. **Soft enforcement.** Pop's supervisor kills a runaway attempt mid-flight;
   a skill can only instruct and record. Every cap in cook (`max_tries`,
   remediation depth) is *orchestrator-checked before the next spawn*, never
   enforced against a live subagent.
2. **Loop reliability.** The drain driver is itself a model following
   instructions, so it can wander or die. The mitigation is pop's own design
   principle, imported whole: all truth lives in files. A crashed or confused
   drain is recovered by re-invoking `/cook`, which re-derives everything from
   the manifest and sidecar state. No in-memory state may ever be load-bearing.
3. **Host capability variance.** Claude Code and Pi expose different
   primitives. Cook imports pop's Supported/Blind capability-declaration
   pattern as a host capability matrix (`docs/spec/10-hosts.md`): a host
   declares each capability Supported or Blind, and Blind capabilities degrade
   to documented behavior instead of silently breaking.

## Considered Options

- **Ported external orchestrator** — rewrite pop's executor per language as a
  standalone program. Rejected: it is not a plugin, gains nothing over
  installing pop itself, and multiplies the maintenance surface per language.
- **Hook-driven loop as the primary mechanism** — a stop hook (Claude Code) or
  `agent_settled` handler (Pi) re-injects "continue the drain" until terminal.
  Rejected as the *primary* mechanism: host-specific and opaque, and it makes
  correctness depend on the host's hook semantics. Kept as optional per-host
  hardening on top of the file-truth loop.

## Sources in pop

- `supervisor/` (the external enforcement cook gives up), `tasks/attempts.go`
  (timeout + process-group SIGKILL at the attempt seam)
- pop `CONTEXT.md`: **Implement run**, **Drain**, **Task retry cap**
- pop ADR-0190 (per-adapter Supported/Blind capability declarations — the
  pattern the host matrix imports)
