# 03 — The Drain and the Implement run

## Two loops, one invocation

One `/cook:drain` invocation is one **Implement run**: from set selection to
exit. One Implement run holds **at most one live Drain** at a time and may
comprise several: reaching a gate parks (finishes) the held Drain, and
resuming AFK work afterward begins a fresh Drain. The Implement run — not the Drain — owns the gates, the refine
phase, and the verify phase.

A **Drain** is one supervised pass over the set's eligible AFK tasks,
ending at a terminal disposition. A set may be drained many times — after a
gate, a crash, an interrupt — and each is a distinct Drain. The Drain
carries execution lifecycle; the set's manifest-derived status (what work
remains) is a separate, derived concern (`02-status-derivation.md`).

## The drain loop

The Drain runs as a sequence of **Drain turns**. Each turn re-reads its
inputs from files — the manifest, `state.json`, and `.cook/config.json` —
then dispatches through four phases in order. This order is pop's
`run_tasks` loop, ported:

```
loop (one Drain turn):
  re-read manifest + state.json + config; derive status   (02)
  1. refine phase        — non-gating (07); fixes in place and commits; the
                           only directive it can hand back besides falling
                           through is the human's interrupt
  2. verify phase        — owns the whole verification choreography (06);
                           hands back: keep draining | park at a gate | fall through
  3. terminal handling   — DONE / FAILED / BLOCKED / AWAITING-APPROVAL /
                           VERIFY-FAILED / DEFERRED: open the matching gate (08)
                           or exit with the disposition
  4. task execution      — select the next eligible AFK task (manifest order),
                           run the attempt loop (05); on success, commit (04)
  repeat
```

Consequences of the order:

- Refine sits **ahead** of verify, so a pass's edits are judged by the same
  Verifier run as the work they refine, and the pass costs no verification
  of its own.
- The verify phase sits **ahead** of terminal handling, so on a set
  entering `AWAITING-APPROVAL` the Verifier runs **before** the HITL
  sign-off gate opens — cheap agent checking precedes expensive human
  time. A PASS opens the gate.
- A FIXABLE verdict spawns a Remediation task inside the verify phase
  (`06-verify.md`); the next turn's status derivation finds an eligible
  AFK task again and the loop naturally continues draining — the
  remediation loop is this loop. The lap re-verifies without re-refining:
  Remediation tasks stay out of the Refine episode (`07-refine.md`).

## Configuration is read every turn

A configuration change made while a Drain runs applies at its **next
turn**, never sooner and never later: `refine`, `verify`, `max_tries`,
`retry_delays`, `remediation_depth` and `include_implementation_convention`
are re-read with the manifest at the top of each turn. What the Drain
settled at start holds for the whole Drain: `commit_overrides` and the
dirty-checkout strategy. Per-invocation arguments still override config.

A `.cook/config.json` that fails to parse leaves the **previous turn's**
configuration in force, and the Drain says so once — `Configuration
re-read failed for <path>; keeping the previous configuration: <error>` —
and once more when it recovers — `Configuration re-read recovered for
<path>`. A missing file is not a failure: it means the defaults. At drain
start there is no previous turn, so an unparseable file (or the retired
`review` key, `07-refine.md`) refuses the drain.

Task selection within a Drain is **manifest order** among eligible tasks:
the tasks array is the authored sequence, and `blocked_by` — not position —
is the dependency truth.

The Drain ends when the derived status leaves `READY`: at `DONE`,
`FAILED`, `BLOCKED`, `AWAITING-APPROVAL`, `VERIFY-FAILED`, or `DEFERRED` —
or when the human interrupts (the Interrupt gate, `08-gates.md`).

## Re-entrancy

There is no in-memory state worth recovering. Every Drain turn
re-derives status from the manifest and sidecar; every completed task is
already committed and finalized in one write. An interrupted, crashed, or
wandering drain is resumed by invoking `/cook:drain` again: the new Implement run
derives the same world and continues where the files say. Implementations
MUST NOT cache derived status across turns.

This is also the wandering-orchestrator mitigation: an orchestrator session
that lost the thread cannot corrupt the set, because the files — not its
recollection — are re-read at each turn, and any drift is corrected on
the next turn.

## Concurrency

Pop guards a running drain with a database-backed Runtime execution lock.
Cook has no guard (ADR-0015). Two rules are the human's discipline:

- Run **one drain per set at a time**.
- Run no `/cook:verify` or `/cook:refine` on a set while a drain runs on it.
  A Verifier or Refiner reading files a drain is rewriting judges a tree that
  never existed, and both write `state.json`.

Keeping these is what makes the Orchestrator the single writer of a set's
files (ADR-0008). Nothing detects a breach: two drains on one set race on
`manifest.json` and may implement the same task twice. Pop's checkout-wide
admission (ADR-0238) is deferred (`PARITY.md`).

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

- `tasks/run_tasks.go:199-275` — the loop order (refine phase → verify
  phase → terminal switch → task execution; the explore step at its head
  is deferred)
- `tasks/implement_run.go` (`reloadConfig`), `tasks/run_plan.go` — config
  re-read every Drain turn; what is settled at start
- `GLOSSARY.md` — glossary entries: **Drain**, **Implement run**,
  **Drain turn**, **Implement** (drain stop conditions, HITL gate
  behavior), **Dirty runtime strategy** (`continue` semantics), **Runtime
  execution lock**
- pop ADR-0086 (pre-approval verify phase), ADR-0252 (refine before verify),
  ADR-0267 (config re-read every Drain turn)
- Cook divergences: no execution lock at all (ADR-0015);
  `continue` as the only dirty strategy with a mandatory confirmation;
  worktrees/bindings/fold OUT. See `PARITY.md`.
