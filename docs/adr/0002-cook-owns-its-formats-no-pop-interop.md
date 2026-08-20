---
status: accepted
date: 2026-08-20
---

# Cook owns its formats; pop interop is a non-goal

Byte-identical storage would have let one task-set directory be drained by
either tool, but the interop claim was hollow from the start — pop keeps its
verdict cache, drain lifecycle, and bindings in `pop.db`, which cook cannot
read — and the user wants cook to carry zero pop dependency. We decided that
cook keeps pop's *shape* because it is load-bearing, hard-won design, while
every name and byte is cook's own, and pop↔cook interop is explicitly not a
goal.

What is kept as shape:

- The **State / Journal separation**: `manifest.json` is the current,
  authoritative truth of each task's status, overwritten in place;
  `progress.txt` is the append-only journal of distilled outcomes. Pop
  documents this three-store split as a lesson learned, not a convenience.
- The **acceptance-checkbox mechanic**: one `.md` file per task carrying
  "What to build" and "Acceptance criteria" checkboxes that the implementer
  ticks — it is load-bearing for the attempt contract cook ports verbatim.
- One task set = one self-contained directory at `.cook/tasks/<set-id>/` in
  the target repo: travels with the repo, no global state.

What replaces pop's database: a per-set `state.json` sidecar (verdict cache,
verification/review episode fingerprints, per-task attempt counters,
remediation depth used) plus slim per-attempt records as the retry digest's
substrate.

## Consequences

- Porting from pop stays **concept-level**: a 1:1 term map (see `PARITY.md`),
  never byte-level diffing of storage files.
- A pop task set is not a cook task set and never will be; migration, if ever
  wanted, is a one-off conversion script, not a compatibility promise.

## Sources in pop

- pop `CONTEXT.md`: **Task manifest**, "Manifest vs progress record vs
  captured stream (State vs Journal vs Telemetry)" (the three-store lesson)
- `tasks/` storage layout (`index.json`, per-task markdown, `progress.txt`,
  `spec.md`), `store/` (pop.db — the part cook replaces with `state.json`)
