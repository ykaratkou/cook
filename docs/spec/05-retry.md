# 05 — The attempt retry loop

The retry loop is the third of cook's four nested loops (doc 00): it sits inside
the Drain (doc 03) and wraps individual attempts (doc 04). One task gets up to
`max_tries` **started** subagent invocations before it is marked failed. Retries
are not blind re-runs: every attempt after the first carries a digest of what the
prior attempts did and how they ended.

## The cap

- `max_tries` (`.cook/config.json`, default **3**) is the maximum number of
  started attempts per task. It counts attempts that ran; an attempt that never
  started (host refused to spawn) consumes nothing.
- Attempt counters are persisted per task in the manifest's `attempts` field
  (doc 01) **before** each spawn. A re-entered drain — crash, interrupt, session restart — resumes
  the count; it never resets. Re-entrancy is cook's substitute for a supervisor:
  the counter on disk is the enforcement, not the orchestrator's memory.
- Exhausting the cap transitions the task `open → failed` with the last
  attempt's failure reason, records the FAILED journal entry (doc 01), and the
  drain stops at the **Failed gate** (doc 08).
- There is **no agent fallback**. Pop walks an ordered preset list when one
  agent's cap is exhausted; cook has exactly one agent — the host — so the cap
  is final. Ledgered OUT in `PARITY.md`.

## Retry delays

- `retry_delays` (`.cook/config.json`, default **`[]` = off**, ADR-0004): an
  ordered list of duration strings. When non-empty, each entry is one
  inter-attempt wait (first retry waits `retry_delays[0]`, second
  `retry_delays[1]`, …) and once the list is exhausted the **last entry repeats**
  for every subsequent retry.
- Default-off is a deliberate departure from pop (which defaults to
  `["1m", "5m", "15m"]`): sleeping inside an attended agent session wastes the
  human's time, and the failure classes backoff protects against (rate limits,
  flaky infrastructure) are the host's concern in-agent. The key exists so a
  future headless mode can turn it back on.

## Human reset — the digest's scope cut

The Failed gate's *re-run* outcome (doc 08) reopens the task and writes a
`RESET` marker to the journal with a timestamp. Attempt records written **before
the latest RESET are excluded from the digest**: a human reopens precisely
because the prior line of attack was abandoned, so carrying its lessons forward
would steer the fresh attempt back onto the ground the human just rejected. The
attempt *counter* also restarts at the reset — a reopened task gets a fresh cap.

## The prior-attempt digest

On attempt > 1, the orchestrator appends a digest section to the implementer
prompt (doc 09). Its substrate is the slim attempt records (doc 01): ordinal,
outcome, failure reason, and a short narrative tail per attempt —
recorded for exactly this purpose; they are not telemetry.

Rendering, ported verbatim from pop — attempts read most-recent-last so the
freshest lesson sits closest to the task instructions:

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

The lesson attached to each prior attempt is derived from that attempt's
`(outcome, reason)` — never asked of a model. (Pop's mapping also reads the
subprocess exit code; a subagent has none, so cook's `crashed` outcome — the
spawn errored or the subagent died without producing output — stands in for
pop's non-zero exit.) The design intuition
(pop ADR 0040): the dominant real failure is a **correct line of attack cut off
before the completion sentinel**, where "try a different angle" is exactly the
wrong instruction. Contract failures therefore *continue*; only a crash or an
empty session *reassesses*.

Lesson texts, ported verbatim:

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

Contract failures are the harness's own verdicts (doc 04): the attempt did the
work but missed a clause of the completion contract, and the lesson names the
exact clause rather than sending the retry back over ground that was sound.

## Dormant branches in cook v1

Kept in the table so a host that can enforce them slots in without a spec
change; they cannot fire on either v1 host:

- **Turn cap exhausted** — turn-cap enforcement is Blind on both hosts
  (doc 10). The lesson is the retry's whole reason to know a turn cap exists;
  it stays specified, dormant.
- **Quota-paused / agent-unusable** — cook has no quota detection and no
  multi-agent catalog; the host surfaces its own quota errors to the human.
  A subagent spawn that fails outright consumes no attempt.
- **Timed out** — timeout kill is Blind in v1 (doc 10; Pi's spawning extension
  is Supported-capable, revisit). Until a host enforces one, a hung attempt is
  the human's interrupt, which lands in the *interrupted* branch.

## Sources in pop

- `tasks/digest.go` — lesson constants, `attemptLesson`, `isContractReason`,
  `contractLesson`, `formatPriorAttemptDigest`, the since-last-RESET scope cut
- `tasks/attempts.go` — `executeTaskAttempts` (cap, delays, finalizeTaskFailed)
- `CONTEXT.md` — **Task retry cap**, **Task attempt retry schedule**,
  **Turn cap exhaustion**, **Agent fallback** (ported OUT)
- `docs/adr/0040` (retry carry-forward), `docs/adr/0190` (turn cap; exhaustion
  consumes a try and enters the digest)
