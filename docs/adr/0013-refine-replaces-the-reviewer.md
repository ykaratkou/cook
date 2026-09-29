---
status: accepted
date: 2026-09-29
---

# Refine replaces the Reviewer

Pop turned its read-only code review into **Refine**. A fresh Refiner holds
the set's changeset to the repository's Implementation convention, fixes in
place what is reversible, and writes a three-part report. The runner commits
the fixes, and the pass runs *before* the verify phase (pop ADR-0252,
0246, 0247, 0248, 0260). Cook's Reviewer was a port of the old step, so it had
to either follow the rename or become a standing divergence.

We decided cook **ports Refine and deletes the Reviewer**. The pass keeps
cook's **on-by-default** setting (user decision, 2026-09-29). `refine`
replaces `review` in `.cook/config.json`, and `/cook:refine` replaces
`/cook:review`. The Reviewer prompt gives way to pop's `refiner.tmpl.md`,
ported as marked edits. The implementer prompt gains pop's Prior-art check
(ADR-0259) in the same port.

## Consequences

**ADR-0005 is amended, not reversed.** Its argument for review-on-by-default
was that review never gates, so running it costs nothing. That argument no
longer covers a pass that writes code. What makes on-by-default safe now is
the order: Refine runs before verify, and verify is also on by default, so every
Refine commit is judged by the same Verifier run as the work it refines. The
Refiner still gates nothing. A Refine failure is reported and dropped, and
the set reaches exactly the status it would reach with Refine off.

**Cook ships two convention ranks, not pop's four.** Pop resolves the
`implementation` and `verification` conventions through a four-rank stack
that always answers. Cook ports the repository rank (`docs/agents/<kind>.md`)
and the shipped rank (`conventions/<kind>.md`, pop's shipped text with
recorded edits). It also ports the repository Overlay on the refine step. Pop's
per-user ranks under `~/.agents/docs/` are OUT, because they are one human's
machine-wide preferences and cook has no machine-wide configuration. The
shipped Verification convention also becomes the Verifier's "How work is
checked" section (pop ADR-0227).

**The abandon restore excludes `.cook/`, so a pass needs a clean tree.** Pop
snapshots whatever dirt the tree holds before the pass and, on `abandoned`,
restores it with `reset --hard` + `clean -fd` + `stash apply`. Cook's task
storage lives inside the checkout, so that restore would roll back or delete
the report and state files the pass had just written. Cook restores with a
pathspec that excludes `.cook/`, and requires the tree outside `.cook/` to be
clean when the pass begins. That is the ordinary case at a standstill, since
every task commit is `git add -A`. The same pathspec decides whether a pass
fixed anything: if nothing changed outside `.cook/`, there is no Refine commit.

**The Refine mark reads the Sidecar state.** Pop derives the mark from the
latest Captured run of phase `refine`. Captured runs are OUT, so cook writes
`refine_last` to `state.json`: `started` before the spawn, then the parsed
outcome afterwards. A leftover `started` reads as interrupted.

**Remediation tasks gain an `origin` field.** The Refine episode leaves
Remediation tasks out, so a verify-remediation lap does not re-refine. Pop
tells them apart by id pattern. Cook's docs already said remediation tasks
had an origin, but the manifest had no field for it. `origin: auto | human`
now makes it explicit.

**The retired `review` key is an error.** It is not an alias. `review: false`
read as an alias would silently let a code-writing pass run where the human
had switched off a read-only one. Pop treats its renamed boolean keys the same
way.

**The forced verbs take `drain.lock`.** `/cook:refine` edits and commits, and
`/cook:verify` writes `state.json`. Both hold the set's lock for their run,
so neither judges a tree a drain is rewriting. Pop's checkout-wide admission
(ADR-0238), which this approximates per set, is deferred.

## Sources

- User decision, 2026-09-29: port Refine, on by default.
- Pop ADR-0252, 0246, 0247, 0248, 0259, 0260, 0226, 0227, 0221 (amended:
  no role keeps the read-only posture).
- Cook ADR-0005 (amended here), ADR-0008 (single writer).
