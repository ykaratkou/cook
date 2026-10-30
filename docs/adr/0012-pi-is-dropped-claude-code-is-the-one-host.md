---
status: accepted; partly superseded by ADR-0014
date: 2026-09-28
---

# Pi is dropped; Claude Code is the one host

> **Superseded on one point** (2026-09-29, by ADR-0014): the "one host"
> clause below — "cook supports Claude Code only" — no longer holds.
> opencode 2.x is a second peer host, wired through the seam this ADR kept
> (a matrix column, a delivery note, command wiring; no skill fork). The
> removal of pi stands, ADR-0007 and ADR-0011 stay superseded, and the rest
> of this ADR stands.

Cook shipped for two hosts: the Claude Code plugin and a pi adapter — a TS
extension (`cook_gate`, the six commands, `agent_settled` hardening, a probe
for the `@tintinweb/pi-subagents` prerequisite), a pi package manifest
(`package.json`), and the pi delivery note (`skills/drain/references/host-pi.md`).

We decided **cook supports Claude Code only**. The pi adapter, its package
manifest, and its delivery note are deleted, and every pi row, column, and
aside in the spec set, the ledger, and the READMEs goes with them.

## Consequences

**The host seam stays.** The capability matrix (doc 10), the rule that
skills name capabilities and a delivery note names mechanisms (ADR-0006), and
the shared `prompts/` and `skills/` directories at the repo root are kept. The
matrix now has one column and the drain skill points at one note. Adding a
host back is still one delivery note plus command wiring, with no skill fork.

**Two ADRs are superseded.** ADR-0007 (pi commands are extension-registered
and namespaced) and ADR-0011 (pi subagent spawn is a prerequisite package)
described pi mechanics only. The `/cook:drain` verb they aligned with is
Claude Code's own constraint (plugin commands are always namespaced) and
stands without them.

**Earlier ADRs are left as written.** ADR-0001, 0003, 0006, 0008, and 0010
mention pi as the second host they were weighed against. They record the
reasoning of their day and are not rewritten; where they say "both hosts",
read "the host".

**One ledger row and one drift-guard item go.** The "Subagent isolation on
pi" divergence and the check that the pi matrix rows still match
`@tintinweb/pi-subagents`'s output format existed only for the adapter. Cook
no longer depends on any other project's output format.

**The vendored-skills record keeps its place at the repo root.** It moved
there because pi loads every root-level `.md` in a package's skills directory
as a skill. That reason is gone, but the record's path is wired into the
re-sync automation and the README, and nothing is gained by moving it back.

## Sources

- User decision, 2026-09-28: drop the pi integration.
- Cook ADR-0006 (delivery notes), ADR-0007 and ADR-0011 (superseded here).
