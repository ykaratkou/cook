---
status: accepted
date: 2026-08-20
---

# Attended-only v1, with soft enforcement

Pop's unattended story is a long-running supervisor daemon ticking
reconcile → candidates → dispatch and spawning drains into tmux panes; nothing
of that exists inside an agent session. We decided cook v1 is
**attended-only**: the human invoked `/cook` and is present, so gates may
always ask, and there is no daemon, no auto-drain consent, and no headless
mode.

Enforcement follows ADR-0001's in-agent shape:

- **`max_tries`** (and remediation depth) are orchestrator-checked against the
  sidecar `state.json` before each spawn — a cap is a refusal to spawn again,
  never a kill.
- **Timeout-kill** and the **Turn cap** are declared *Blind* on both hosts in
  the capability matrix: neither Claude Code's Agent tool nor Pi's subagent
  pattern exposes a turn bound or a reliable mid-flight kill to the
  orchestrator. The retry digest's turn-cap lesson is kept anyway, dormant,
  so a future host that can enforce a cap gets the retry semantics for free.
- **Retry delays** default to off. Pop sleeps 1m/5m/15m between failed
  attempts because its drains run unattended overnight; sleeping inside a live
  attended session wastes the human's time. The config key is kept
  (`retry_delays`), documented as a deliberate default divergence in
  `PARITY.md`.

Gate specs still define pop's non-interactive fallback — **stop and report,
never auto-decide** — as the behavior for any future headless mode, so that
mode has semantics on the day someone builds it rather than improvised ones.

## Sources in pop

- `supervisor/` (daemon loop), pop `CONTEXT.md`: **Work supervision**,
  **Task retry cap**, **Task attempt retry schedule**, **Turn cap**
- pop ADR-0190 (a turn cap bounds one implementation attempt, and only claude
  can enforce it — the Supported/Blind precedent for declaring cook's hosts
  Blind)
