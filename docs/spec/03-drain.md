# 03 — The Drain and the Implement run

## Two loops, one invocation

One `/cook` invocation is one **Implement run**: from set selection to
exit. One Implement run holds **at most one live Drain** at a time and may
comprise several: reaching a gate parks (finishes) the held Drain so the
gate conversation runs lock-free, and resuming AFK work afterward begins a
fresh Drain. The Implement run — not the Drain — owns the gates, the verify
phase, and the review phase.

A **Drain** is one supervised pass over the set's eligible AFK tasks,
ending at a terminal disposition. A set may be drained many times — after a
gate, a crash, an interrupt — and each is a distinct Drain. The Drain
carries execution lifecycle; the set's manifest-derived status (what work
remains) is a separate, derived concern (`02-status-derivation.md`).

## The drain loop

Each iteration re-derives the world from files, then dispatches through
four phases in order. This order is pop's `run_tasks` loop, ported:

```
loop:
  re-read manifest + state.json; derive status          (02)
  1. verify phase        — owns the whole verification choreography (06);
                           hands back: keep draining | park at a gate | fall through
  2. review phase        — non-gating (07); the only directive it can hand
                           back besides falling through is the human's interrupt
  3. terminal handling   — DONE / FAILED / BLOCKED / AWAITING-APPROVAL /
                           VERIFY-FAILED / DEFERRED: open the matching gate (08)
                           or exit with the disposition
  4. task execution      — select the next eligible AFK task (manifest order),
                           run the attempt loop (05); on success, commit (04)
  repeat
```

Consequences of the order:

- The verify phase sits **ahead** of terminal handling, so on a set
  entering `AWAITING-APPROVAL` the Verifier runs **before** the HITL
  sign-off gate opens — cheap agent checking precedes expensive human
  time. A PASS opens the gate.
- A FIXABLE verdict spawns a Remediation task inside the verify phase
  (`06-verify.md`); the next iteration's status derivation finds an
  eligible AFK task again and the loop naturally continues draining — the
  remediation loop is this loop.
- The review phase runs after verification and gates nothing.

Task selection within a Drain is **manifest order** among eligible tasks:
the tasks array is the authored sequence, and `blocked_by` — not position —
is the dependency truth.

The Drain ends when the derived status leaves `READY`: at `DONE`,
`FAILED`, `BLOCKED`, `AWAITING-APPROVAL`, `VERIFY-FAILED`, or `DEFERRED` —
or when the human interrupts (the Interrupt gate, `08-gates.md`).

## Re-entrancy

There is no in-memory state worth recovering. Every loop iteration
re-derives status from the manifest and sidecar; every completed task is
already committed and finalized atomically. An interrupted, crashed, or
wandering drain is resumed by invoking `/cook` again: the new Implement run
derives the same world and continues where the files say. Implementations
MUST NOT cache derived status across iterations.

This is also the wandering-orchestrator mitigation: an orchestrator session
that lost the thread cannot corrupt the set, because the files — not its
recollection — are re-read at each iteration, and any drift is corrected on
the next derivation.

## Concurrency guard

Pop's Runtime execution lock is database-backed; cook uses a lockfile.

- On drain start, create `.cook/tasks/<set-id>/drain.lock` containing
  `{ "session": "<host session identifier>", "at": "<RFC3339>" }`,
  refreshing `at` on every loop iteration. The `session` value doubles as
  the loop-hardening's scoping key: each host's hardening nags only the
  session it can positively match to the lock (the per-host matching
  mechanism is declared in `10-hosts.md`); an unmatchable value forfeits
  hardening for that drain, nothing else.
- A drain finding a fresh lock (refreshed within the staleness window,
  default 10 minutes) MUST refuse: report who holds it and stop. Never
  auto-steal a fresh lock.
- A stale lock (older than the window) MAY be taken over after telling the
  human — the previous drain crashed without cleanup.
- Remove the lock on every exit path, gates included (a parked Drain is
  finished; the gate holds no lock).

## Dirty-checkout strategy

Cook ports only pop's default strategy, `continue`: a drain starting from a
dirty checkout starts **without touching the existing dirty state**, and —
said plainly — the first completed task's implementation commit (`git add
-A`, `04-attempt.md`) deliberately sweeps those pre-existing changes in with
the agent's work. When the checkout is dirty at drain start, the
orchestrator MUST show the human `git status` and this consequence, and
proceed only on confirmation. Pop's `commit-and-continue` and
`stash-and-continue` strategies are OUT (ledgered).

## Where the drain runs

The current checkout, always. Cook has no worktree provisioning, no
bindings, no fold — reconciling a branch is the human's own concern (a PR
or a manual merge). One repository, one checkout, one drain at a time per
set.

## Sources in pop

- `tasks/run_tasks.go:134-210` — the four-directive loop order (verify
  phase → review phase → terminal switch → task execution)
- `CONTEXT.md` — glossary entries: **Drain**, **Implement run**,
  **Implement** (drain stop conditions, HITL gate behavior), **Dirty
  runtime strategy** (`continue` semantics), **Runtime execution lock**
- pop ADR-0086 (pre-approval verify phase), ADR-0214 (review phase)
- Cook divergences: lockfile instead of the DB-backed execution lock;
  `continue` as the only dirty strategy with a mandatory confirmation;
  worktrees/bindings/fold OUT. See `PARITY.md`.
