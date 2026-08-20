# Status derivation

One derivation answers "what is this set's status?" everywhere it is asked —
`/cook:status`, set selection, and the drain's own phase decisions. It is
**read-only and side-effect-free**: deciding to *run* the Verifier on a cache
miss belongs to the drain loop, never to status. Never re-derive your own
variant; route every surface through this.

## Task eligibility

A task is **eligible** when all three hold:

1. its `status` is `open`,
2. its `type` is `afk`,
3. every `blocked_by` prerequisite has status `done` **or** `skipped`.

A skipped task unblocks its dependents even though it was deferred, not
completed. HITL tasks are never eligible — the executor never runs them.

## Derived set status (manifest layer)

Evaluated in this order; the first match wins:

| Condition | Status |
| --- | --- |
| manifest missing or unparseable, or a validation **error** (register rules) | `MALFORMED` |
| any task has status `failed` | `FAILED` |
| every task has status `done` | `DONE` |
| at least one eligible AFK task exists | `READY` |
| no open AFK work remains; open HITL task(s) remain | `AWAITING-APPROVAL` |
| open AFK work exists, but every open AFK task is gated behind an open HITL task | `BLOCKED` |
| no eligible work and none of the above (open work skipped around) | `DEFERRED` |

`MALFORMED` sits outside the ordinary derivation — a registration and
contract fault, repaired via `/cook:register`'s fix list, never by draining.

The **terminal zone** is `DONE` and `AWAITING-APPROVAL`: the manifest says
the AFK work is finished.

## Verification layering (when `verify` is enabled)

With verification enabled (cook's default), layer the manifest-derived status
with the verdict state in `state.json`. Inputs: the current work SHA (`HEAD`
of the checkout), the verdict cache, `last_pass`, and the episode fingerprint
(see `verify.md` for when they still count).

Only the terminal zone is gated:

- A **current PASS** (a `last_pass` in the current episode) lets the terminal
  status stand.
- A PASS at an older SHA still stands — **a PASS immunizes against later
  commits**. Show the annotation `verified at <sha>` when HEAD has moved past
  the verified SHA. Terminal status never regresses on commits alone.
- A **current non-PASS** verdict (FIXABLE with remediation exhausted, or
  NEEDS-HUMAN) forces `VERIFY-FAILED`.
- **No PASS in the current episode** regresses the displayed status to
  `NEEDS-VERIFY` — the manifest says finished, but nothing has confirmed it
  this episode.

**Human completion outranks the verdict.** When the terminal state was
reached through a task carrying `human_completed`, the terminal status stands
whatever the verdict says; derive and show the verdict *beside* the status as
a verification mark, never *as* the status. A human closed the work; cook
does not reopen it over an agent's opinion.

With `verify` disabled, status derives from the manifest alone.

Non-terminal statuses (`READY`, `BLOCKED`, `FAILED`, `DEFERRED`) are never
modified by verdicts.

## Set selection

No-argument `/cook` selects among sets under `.cook/tasks/`:

1. Consider only sets deriving `READY`.
2. Order by `priority` descending, ties by set-id ascending.
3. The first is the selection.

Selection **passes over** `DONE`, `DEFERRED`, and `AWAITING-APPROVAL` sets;
they are reachable only by naming them explicitly. A `MALFORMED` set is
reported, never selected. When no READY set exists, report the nearest
actionable state (an AWAITING-APPROVAL set to sign off, a BLOCKED set's
gating HITL task) and stop — never invent work.

## Sources

`docs/spec/02-status-derivation.md` in the cook repository (pop sources in
its footer).
