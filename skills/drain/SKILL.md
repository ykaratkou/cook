---
name: drain
description: Cook's drain orchestrator — the instruction set for one Implement run over a task set (drain loop, attempts, retries, verification, review, gates). Loaded by the /cook command; never start a drain on your own initiative.
user-invocable: false
---

# The drain orchestrator

You are the **Orchestrator** of a cook Implement run: the human's own agent
session running one task set from selection to exit. You select tasks, spawn
fresh-context subagent Attempts, assess their output, make the implementation
commits, run the Verifier and Reviewer, and stop at human gates. You are
instructions over files, not a process — **files are the only truth**, and a
crashed or wandering orchestrator is recovered by invoking `/cook` again.

Authoritative behavior lives in this skill and its references. When in doubt,
the spec set in the cook repository (`docs/spec/00`–`10`) is the binding
source; this skill is its operational rendering.

## Ground rules — in force for the whole run

1. **Re-derive, never remember.** Every loop iteration re-reads
   `manifest.json` and `state.json` and re-derives status
   ([references/status.md](references/status.md)). Never cache derived status
   across iterations; never act on your recollection of a file.
2. **You never implement.** Task work is done only by fresh-context subagent
   Attempts. Your own writes are limited to: cook's files under
   `.cook/tasks/<set-id>/`, the implementation commits, and the remediation
   task files the verify phase spawns.
3. **The human decides every gate outcome.** You effect no disposition —
   no complete, skip, reset, accept, or remediation spawn — except as the
   direct execution of the human's answer to a gate's structured ask
   ([references/gates.md](references/gates.md)).
4. **Atomic writes.** Every write to `manifest.json`, `state.json`, and
   `progress.txt` goes to a temporary file in the same directory, then a
   rename over the target. Where two facts must land together (a task's done
   status and its commit SHA), they land in one manifest write.
5. **Soft enforcement.** Caps (`max_tries`, `remediation_depth`) are checked
   by you **before** each spawn against the counters on disk. You cannot
   bound or kill a running subagent (turn cap and timeout are Blind on this
   host) — never claim or emit a bound you cannot enforce.

## Configuration

Read `.cook/config.json`. Missing file or missing keys mean the defaults:

```json
{ "max_tries": 3, "retry_delays": [], "verify": true, "review": true,
  "remediation_depth": 2, "commit_overrides": [] }
```

Per-invocation arguments override config.

## Startup

1. **Resolve the set.** With a set-id argument, use that set. Without one,
   select per [references/status.md](references/status.md) (highest-priority
   READY set; when none is READY, report the nearest actionable state and
   stop — never invent work).
2. **Take the lock.** Check `.cook/tasks/<set-id>/drain.lock`:
   - Fresh lock (refreshed within 10 minutes): **refuse** — report who holds
     it and stop. Never auto-steal a fresh lock.
   - Stale lock: tell the human the previous drain crashed without cleanup,
     then take over.
   - Otherwise create it: `{ "session": "<host session identifier>",
     "at": "<RFC3339 UTC now>" }`. Use the best session identifier the host
     gives you (a session id if known, else your PID-like handle or a fresh
     random token). Refresh `at` on every loop iteration.
3. **Dirty-checkout confirmation.** If `git status --porcelain` is non-empty
   at drain start, show the human the status and this consequence: cook's
   only dirty strategy is `continue` — the first completed task's
   implementation commit (`git add -A`) will sweep these pre-existing changes
   in with the agent's work. Proceed only on the human's confirmation
   (AskUserQuestion: proceed / stop).

## The drain loop

Each iteration, in order:

```
re-read manifest.json + state.json; derive status     (references/status.md)
refresh drain.lock's "at"
1. verify phase      — references/verify.md; hands back one of:
                       keep draining | park at a gate | fall through
2. review phase      — references/review.md; non-gating, falls through
                       (only a human interrupt stops it)
3. terminal handling — DONE / FAILED / BLOCKED / AWAITING-APPROVAL /
                       VERIFY-FAILED / DEFERRED: open the matching gate
                       (references/gates.md) or exit with the disposition
4. task execution    — select the next eligible AFK task in manifest order;
                       run the attempt loop (references/retry.md, each
                       attempt per references/attempt.md)
repeat
```

Consequences of the order — do not reorder:

- On a set entering AWAITING-APPROVAL the Verifier runs **before** the HITL
  sign-off gate opens; a PASS opens the gate.
- A FIXABLE verdict spawns a Remediation task inside the verify phase; the
  next iteration's derivation finds eligible AFK work again and the loop
  continues — the remediation loop **is** this loop.
- The review phase runs after verification and gates nothing.

Task selection within a drain is **manifest order** among eligible tasks; the
tasks array is the authored sequence, `blocked_by` is the dependency truth.

The drain ends when the derived status leaves READY — DONE, FAILED, BLOCKED,
AWAITING-APPROVAL, VERIFY-FAILED, or DEFERRED — or on the human's interrupt
(Interrupt gate).

**Do not end your turn mid-drain.** While the set derives READY and no gate
is open, run the next iteration. Ending the turn is for: a gate's structured
ask having been answered with an exit, a terminal disposition reported, or a
refusal (lock, MALFORMED set).

## Gates park the drain

Reaching a gate finishes the current Drain: **remove `drain.lock` before the
gate conversation** (a parked drain holds no lock). Choosing an outcome that
resumes AFK work begins a fresh Drain — retake the lock and re-enter the
loop. Remove the lock on **every** exit path.

## Exit

On exit: remove `drain.lock`, then report the disposition — the set's derived
status, what was completed this run (from `progress.txt`), the verification
mark, and the review pointer when one exists.

## Rendering prompts

All subagent and gate prompts are the files in
`${CLAUDE_PLUGIN_ROOT}/prompts/`. Render one as follows:

1. Substitute each `{{name}}` placeholder verbatim.
2. Evaluate `{{#if condition}}…{{/if}}` — drop the section, heading included,
   when the condition does not hold. Repeat `{{#each list}}…{{/each}}` per
   element.
3. Inline each `{{> partial-name}}` with the named block from
   `prompts/partials.md`, rendered by the same rules.
4. Strip cook's source markers: `[COOK: text]` renders as `text`.
5. **Never paraphrase.** The rendered prompt is the template with holes
   filled — the loop's reliability lives in this exact wording.

Delivery on this host: the rendered text is the subagent's task text (the
Agent tool prompt). Never pass a prompt on a command line.

## Spawning subagents

Every Attempt, Verifier run, and Reviewer run is a **fresh-context
subagent**: one Agent tool call (`subagent_type: "general-purpose"`) whose
prompt is the rendered template and whose return value is the run's entire
output. No shared conversation state; the subagent is never spoken to again.
A spawn that fails outright (the tool errors before the subagent runs)
consumes no attempt.

## References

| File | Covers |
| --- | --- |
| [references/status.md](references/status.md) | Eligibility, derived statuses, verification layering, set selection. |
| [references/attempt.md](references/attempt.md) | One attempt: spawn, completion contract, assessment, the five-step commit. |
| [references/retry.md](references/retry.md) | The retry loop: cap, lessons table, prior-attempt digest, RESET scope cut. |
| [references/verify.md](references/verify.md) | The verify phase: episodes, verdict dispositions, remediation, force mode. |
| [references/review.md](references/review.md) | The review phase: episode, the document, the pointer, force mode. |
| [references/gates.md](references/gates.md) | The four gates: common rules, asks, and outcome execution. |

## Sources

Operational rendering of the cook spec set: `docs/spec/00-overview.md`,
`02-status-derivation.md`, `03-drain.md` (loop order, re-entrancy, lock,
dirty strategy), `09-prompts.md` (rendering rules), `10-hosts.md`
(claude-code capability row). Pop sources are named in those documents'
footers.
