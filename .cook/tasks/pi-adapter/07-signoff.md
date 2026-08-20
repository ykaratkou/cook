# Human sign-off: install cook on pi and run a toy drain

## Parent
`spec.md` in this set (Testing Decisions: the attended full-stack seam);
`pi/README.md` from task 06.

## What to build

Human-only verification that the adapter works end to end on this machine.
(All artifacts were built by tasks 01–06; this task is judgment and
observation only.)

1. Install per `pi/README.md`: add the `extensions` and `skills` entries to
   your settings (global `~/.pi/agent/settings.json` in the dotfiles, or a
   project `.pi/settings.json`), open pi, confirm the six cook commands
   appear.
2. In a scratch target repo, author or reuse a toy task set (one trivial
   AFK task + terminal HITL sign-off), then run `/cook:drain` inside pi.
   Watch: the sealed `cook_subagent` attempt, the implementation commit,
   the Verifier tail, the review document, and the HITL gate asking through
   `cook_gate` dialogs.
3. Exercise the hardening once: while the drain is mid-flight, observe an
   `agent_settled` re-injection (or confirm it stays silent when it
   should).
4. Read the task-06 doc edits and confirm they match what you just
   observed.

## Acceptance criteria

- [ ] Cook installed on this machine via settings arrays; all six commands
      visible in pi.
- [ ] A toy drain ran to DONE inside pi: attempt spawned sealed, commit
      made, Verifier PASS, review document written, HITL gate answered
      through a pi dialog.
- [ ] The hardening behaved as specified (re-injects once mid-flight;
      silent otherwise).
- [ ] Spec/README edits read true against the observed behavior; sign-off
      given.
