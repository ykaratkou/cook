# The attempt retry loop

One task gets up to `max_tries` **started** subagent invocations before it is
marked failed. Retries are not blind re-runs: every attempt after the first
carries a digest of what the prior attempts did and how they ended.

## The cap

- `max_tries` (`.cook/config.json`, default **3**) counts started attempts
  per task; an attempt that never started (spawn refused/errored) consumes
  nothing.
- The counter is the manifest's per-task `attempts` field, persisted
  **before** each spawn (`attempt.md`). A re-entered drain resumes the count;
  it never resets. The counter on disk is the enforcement, not your memory.
- Exhausting the cap transitions the task `open → failed` with the last
  attempt's failure reason, appends the `FAILED` journal block, and the drain
  stops at the **Failed gate** (`gates.md`).
- There is **no agent fallback**: cook has exactly one agent — the host — so
  the cap is final.

## Retry delays

`retry_delays` (default **`[]` = off**): when non-empty, each entry is one
inter-attempt wait as a duration string (first retry waits `retry_delays[0]`,
…); once the list is exhausted the last entry repeats. Default-off is
deliberate — sleeping inside an attended agent session wastes the human's
time. Honor the key when set.

## Human reset — the digest's scope cut

The Failed gate's *re-run* outcome reopens the task and writes a `RESET`
marker to the journal with a timestamp. Attempt records written **before the
latest RESET are excluded from the digest**: a human reopens precisely
because the prior line of attack was abandoned, so carrying its lessons
forward would steer the fresh attempt back onto the ground the human just
rejected. The attempt *counter* also restarts at the reset — a reopened task
gets a fresh cap.

## The prior-attempt digest

On attempt > 1, append this digest section to the rendered implementer
prompt. Substrate: the slim attempt records (ordinal, outcome, failure
reason, narrative tail), scoped to since the latest RESET. Render attempts
most-recent-last so the freshest lesson sits closest to the task
instructions. The template, verbatim:

```
Prior attempts on THIS task (most recent last). They ran on the runtime
checkout you have now, so build on them rather than rediscovering from
scratch. The lesson on each says whether the approach stood:

Attempt 1 — <lesson>
  <narrative tail, indented, blank lines dropped>

Attempt 2 — <lesson>
  <narrative tail>
```

## The lessons table

Derive each prior attempt's lesson from its `(outcome, reason)` — never ask a
model. The design intuition: the dominant real failure is a **correct line of
attack cut off before the completion sentinel**, where "try a different
angle" is exactly the wrong instruction. Contract failures therefore
*continue*; only a crash or an empty session *reassesses*.

Lesson texts, verbatim:

| Constant | Text |
|---|---|
| `lessonContinue` | continue — your approach stood, finish and close out the sentinel |
| `lessonUncheckedBoxes` | continue — your approach stood and the work landed; the attempt failed only because the task file still had unticked acceptance boxes. Tick every `- [ ]` under "Acceptance criteria" to `- [x]` in the task file, then print the summary block and TASK_COMPLETE. |
| `lessonMissingSentinel` | continue — your approach stood; the attempt ended without any line opening on TASK_COMPLETE. Do the remaining work, then close out with the sentinel exactly as the prompt spells it: it starts its own line, and anything you add after it belongs on that line or below. |
| `lessonMissingSummary` | continue — your approach stood; the attempt printed no usable SUMMARY_START…SUMMARY_END block. Close out with a non-empty summary block above TASK_COMPLETE. |
| `lessonReassess` | reassess |
| `lessonResume` | resume — this attempt was cut off mid-flight (not a failure). The runtime checkout already holds the partial changes; read the uncommitted working-tree diff first and continue from it. |
| `lessonTurnCapExhausted` | resume — the previous attempt was cut short at its turn cap (not a failure): it ran out of turns before it could finish. Its changes are already in the runtime checkout; read the uncommitted working-tree diff first, continue from it, and spend your own turns on the remaining work rather than re-deriving what it did. |

Mapping from attempt outcome to lesson, evaluated in order:

| Prior attempt ended with | Lesson |
|---|---|
| Turn cap exhausted | `lessonTurnCapExhausted` |
| Interrupted / quota-paused / agent-unusable | `lessonResume` |
| Timed out | `lessonContinue` |
| Crashed (spawn errored, or the subagent died without output) | `lessonReassess` |
| Contract failure: unchecked acceptance boxes | `lessonUncheckedBoxes` |
| Contract failure: missing TASK_COMPLETE sentinel | `lessonMissingSentinel` |
| Contract failure: missing/empty SUMMARY block | `lessonMissingSummary` |
| Contract failure: any other harness-recorded contract reason | `lessonContinue` + " — the attempt failed the completion contract: <reason>" |
| Empty output / no recorded reason | `lessonReassess` |
| Agent's own `TASK_FAILED: <reason>` | `"pivot/reassess: <reason>"` — the one branch that carries the agent's stated reason forward and licenses a new angle |

Dormant branches (turn cap, timeout, quota-pause — Blind on both current
hosts, per the capability matrix and the delivery notes) stay in the table
so a host that can enforce them slots in without change; they cannot fire
here — do not fabricate those outcomes.

## Sources

`docs/spec/05-retry.md` in the cook repository (pop sources in its footer).
