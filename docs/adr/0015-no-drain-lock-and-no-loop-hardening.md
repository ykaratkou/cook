---
status: accepted
date: 2026-10-30
---

# No drain lock, and no loop hardening

Cook guarded a running drain with `.cook/tasks/<set-id>/drain.lock`, its port
of pop's database-backed Runtime execution lock. The lock refused a second
drain on the same set, and `/cook:verify` and `/cook:refine` took it too. It
was the ground ADR-0008 stood on: the orchestrator is the single writer of a
set's files. It was also the scoping key for loop hardening on both hosts.
The Claude Code stop hook matched the lock's token against the stopping
session's transcript. The opencode plugin matched the lock's `session` against
the idle session's id.

The lock cost more than it guarded. Every Drain turn rewrote it. Every exit
path, gates included, had to remove it. A crash left a stale lock that blocked
the set for ten minutes. Every implementation and Refine commit had to unstage
it. Each host needed its own session-token plumbing. And it guarded a case
the human can avoid by hand.

We decided **cook has no drain lock** (user decision, 2026-10-30). The single
writer is now the human's discipline. The human runs one drain per set at a
time, and runs no `/cook:verify` or `/cook:refine` on a set while a drain runs
on it. Because the lock was the only thing that told hardening which session
was draining, **loop hardening is dropped too**, on both hosts.

## Consequences

- **Resuming is unchanged.** The lock never recorded where a drain stopped.
  The manifest, `progress.txt`, the attempt records, and `state.json` already
  hold all of it, and every Drain turn re-derives status from them
  (doc 03, Re-entrancy). A crash still shows in the files: an attempt record
  for a task still `open`, or a `Cook-Task` trailer naming an `open` task
  (doc 04).
- **Nothing detects a second drain.** Two drains on one set race on
  `manifest.json`, may implement the same task twice, and may leave a torn
  file. A forced verb beside a drain may judge or edit a tree that is
  mid-rewrite. These are now the human's to avoid, not cook's to refuse.
- **ADR-0008's trade still holds, on a different footing.** Writes stay
  non-atomic. The single writer that makes a torn write tolerable is now kept
  by the human, not by a file.
- **A turn that ends mid-drain is resumed by hand.** The human types
  `/cook:drain` again, and the drain picks up where the files say. The
  loop-hardening row leaves the capability matrix. The Claude Code stop hook,
  the opencode idle-event watcher, and the session id in the opencode
  command trailer go with it. ADR-0014's paragraph on event-driven hardening
  no longer applies.
- **ADR-0009 stands.** The Human-facing value still declares subagent trace
  visibility.
- **A `drain.lock` left behind by an older cook is inert.** Nothing reads it,
  and a human may delete it.
- **Pop's checkout-wide admission stays deferred** (`PARITY.md`). Porting it
  would now mean adding a lock back, per checkout rather than per set.

## Considered Options

- **Keep the per-set lock.** Rejected: its whole cost buys protection from a
  mistake the human has committed to not making.
- **One lock per checkout.** Rejected for now. It would also stop two drains
  on different sets from sweeping each other's changes into their commits
  (`git add -A`), but it keeps every cost above. That is the admission port,
  and it stays deferred.
- **Keep hardening with a different trigger**, such as "this session ran
  `/cook:drain` and the set still derives READY". Rejected: each host would
  need status derivation in bash or TypeScript. That is the per-host
  orchestration logic ADR-0003 rejected, and it has more ways to nag the
  wrong session. Hardening was always optional (ADR-0009).

## Sources

- User decision, 2026-10-30: drop the lock ("I will guarantee that I will
  not run two cook drains on the same task set"), and drop hardening with it.
- Pop `GLOSSARY.md` **Runtime execution lock**. Cook ADR-0003 (portable core),
  ADR-0008 (non-atomic writes), ADR-0009 (Human-facing), ADR-0013 (forced
  verbs took the lock), and ADR-0014 (opencode hardening, now dropped).
