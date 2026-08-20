# agent_settled drain-loop hardening

## Parent
`spec.md` in this set; `docs/spec/10-hosts.md` loop-hardening row
("optional; correctness never depends on it");
`claude-code/hooks/stop-drain-guard.sh` (the logic to mirror). Pi docs:
`extensions.md` (`agent_settled`, `sendUserMessage`, `ctx.isIdle`).

## What to build

Extend `pi/extension/index.ts` with the optional loop-hardening: when the
orchestrator model ends its turn while a drain seems mid-flight, re-inject
the continue instruction — pi's `agent_settled` event is purpose-built for
this.

1. On `agent_settled`: look for a fresh `drain.lock` (mtime within 10
   minutes) at `.cook/tasks/*/drain.lock` under the session cwd. None →
   do nothing.
2. Found → send, via `pi.sendUserMessage`, the same instruction text the
   claude-code stop hook emits (adapted verbatim from
   `stop-drain-guard.sh`: the lock path, the set id, "continue the drain
   loop — re-derive from files; do not end your turn while the set derives
   READY and no gate is open; if you are NOT the orchestrator of this set,
   say so and end your turn; do not touch the lock").
3. **Bound the re-injection** (mirror `stop_hook_active`): if the previous
   settle already triggered an injection and no genuine user input arrived
   in between, let the settle pass — a wandering drain is then the human's
   `/cook:drain` re-entry, by design. Track this with in-extension state
   reset on real user input (the `input` event) — never inject twice in a
   row.
4. The hardening must never fire while a `cook_gate` dialog is pending or
   the agent is not idle (`ctx.isIdle()` guard).

## Acceptance criteria

- [ ] With a fresh `drain.lock` present and the agent settling, exactly one
      continue-the-drain user message is injected; a second consecutive
      settle without intervening user input injects nothing.
- [ ] With no lock, a stale lock (older than 10 minutes), or a pending gate
      dialog, settling injects nothing.
- [ ] The injected text carries the lock path and set id and matches the
      stop hook's instruction semantics (continue if orchestrator; step
      aside if not; never touch the lock).
- [ ] The typecheck from task 03 still passes over the grown extension.
