# The four gates

A **gate** is where the drain stops because the next disposition belongs to a
human: **HITL**, **Failed**, **Verify-failed**, **Interrupt**. On this host a
gate is you stopping and asking — **AskUserQuestion presents the gate's
allowed outcomes** — and the assistance behavior is you following the
corresponding rendered gate prompt in-session.

Opening a gate, in order:

1. **Park the drain**: remove `drain.lock` (the gate conversation runs
   lock-free). Choosing an outcome that resumes AFK work begins a fresh
   Drain — retake the lock.
2. **Render the gate's prompt** from `prompts/<gate>-gate.md` (rules in the
   drain SKILL.md) and adopt it as your own instructions for the gate
   conversation — it defines what you show, what you may draft, and what you
   must not do.
3. **Ask** with AskUserQuestion: the gate's allowed outcomes as the options
   (an exit option always present). Free discussion around the ask is fine —
   the prompt is your assistance charter — but the disposition happens only
   through the answer.
4. **Execute the chosen outcome's file writes** as the direct execution of
   that answer, then continue or exit per the outcome.

## Rules common to every gate

1. The Implement run owns the gate; the Drain never does.
2. **The human decides every outcome.** You effect no disposition — no task
   status change (complete, skip, reset, reopen), no verdict recorded, no
   accept, no remediation spawned — *even when the human has told you which
   outcome they want*. They effect it by answering the structured ask; your
   file writes are only the execution of that answer.
3. **You may draft what the human confirms.** A task body, a remediation
   task, a manifest edit, or implementation edits are all fair to *prepare*
   when the human asks. Name drafts plainly; the transition waits for the
   gate answer. New work created at a gate follows the format contract
   (register skill) and is validated the way `/cook:register` validates;
   creating work completes, skips, accepts and remediates **nothing**.
4. **Every gate offers exit.** Leaving changes no task state; the set keeps
   its derived status and the gate reopens on the next `/cook` of the set.
5. Cook v1 is attended-only. If you ever cannot ask, **stop and report** the
   gate, its blocking item, and the allowed outcomes — never auto-decide.

## HITL gate (`prompts/hitl-gate.md`)

**Opens when** the drain needs a HITL task resolved: the set is BLOCKED (open
AFK work gated behind a human task), or AWAITING-APPROVAL with only the
terminal sign-off left. In the sign-off case it opens **after** verification
passed and the review exists.

**Show**: the blocking HITL task's full body; the task-set listing; the
completed-AFK-work summaries from `progress.txt`; the review pointer (never
the body).

**Outcomes**:
- **complete** — the task transitions to done (`COMPLETE` journal block,
  `human_completed: true` on the task). If it was the last open task, the
  set is DONE.
- **defer** (skip) — the task goes `skipped` (`SKIP` journal block);
  downstream `blocked_by` dependents unblock; the set derives DEFERRED.
- **edit and rerun** — the human (with you drafting) edits tasks or
  implementation state, then re-invokes `/cook` on the set.
- **exit** — leave the task open, no disposition.

## Failed gate (`prompts/failed-gate.md`)

**Opens when** a task exhausted `max_tries` and transitioned to failed.

**Show**: the failed task's body; the structured failure reason from the last
attempt (or "no structured failure reason was recorded"); the task-set
listing; the review pointer when one exists.

**Outcomes** (the only two, plus exit):
- **re-run** — help the human fix the underlying problem (repair the
  checkout, sharpen the task body); then reopen the task: status back to
  `open`, `attempts` reset to 0, and a **RESET marker** written to the
  journal with a timestamp — the cut the retry digest scopes to. The human
  then re-invokes `/cook` to retry AFK.
- **complete by hand** — the human finishes the work directly; mark the task
  done with `human_completed: true` (`COMPLETE` journal block). The
  suspension rule in `verify.md` applies to it.
- **exit** — leave the task failed, no disposition.

## Verify-failed gate (`prompts/verify-failed-gate.md`)

**Opens when** the Verifier returned NEEDS-HUMAN, or FIXABLE with the
remediation depth cap exhausted.

**Show**: the recorded Verifier findings (or "none were recorded for this
verdict"); the commit range and complete `git diff --stat` (fetch any file's
diff on request); the task-set listing; the review pointer.

**Outcomes**:
- **accept** — record a **human-authored PASS** (`HUMAN-PASS` in
  `verdict_cache`, plus `last_pass`) with an optional note persisted as
  `human_note` in `state.json`. Episode immunity applies. The note feeds
  every future Verifier of this set as the prior-human-note section.
- **remediate** — spawn a remediation task (origin `human`) carrying the
  findings and an optional note. This is the one outcome you are expected to
  **pre-draft**: write the task from the findings and offer the draft for
  confirmation instead of making the human retype it. Spawning invalidates
  cached verdicts; the next `/cook` drains it. Human-origin remediation does
  not count against the depth cap's exhausted state — the human's explicit
  choice overrides the cap.
- **exit** — leave the set VERIFY-FAILED, no disposition.

**Not offered**: re-running the Verifier — that is `/cook:verify`, a separate
force action; a gate that offers "ask again" invites verdict-shopping.

## Interrupt gate (`prompts/interrupt-gate.md`)

**Opens when** a live attempt was cut off mid-run by the human's interrupt
(Esc cancelling the running spawn).

First, record the interrupted attempt in its attempt record with outcome
`interrupted` — it consumes a try, and the digest gives the next attempt the
*resume* lesson (the checkout already holds the partial changes).

**Show**: the interrupted task's full body; the task-set listing; the review
pointer when one exists.

**Outcomes**:
- **continue draining** — re-run the interrupted task; a fresh Drain begins.
- **exit** — leave the task open, no disposition.

At this gate you advise and edit by hand only; never resume the drain
yourself — the human chooses through the ask.

## Sources

`docs/spec/08-gates.md` in the cook repository (pop sources in its footer).
