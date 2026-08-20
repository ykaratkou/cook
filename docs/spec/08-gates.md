# 08 — The four gates

A **gate** is where the drain stops because the next disposition belongs to a
human. Cook has four: **HITL**, **Failed**, **Verify-failed**, and
**Interrupt**. In pop each gate is a TUI menu with an optional separate
attended-assistance session; in cook the human is already inside the agent
session, so the gate is the orchestrator **stopping and asking** — the host's
structured-ask primitive (doc 10) presents the gate's allowed outcomes — and the
assistance behavior is the orchestrator itself following the corresponding
ported prompt (doc 09) in-session. No separate assistance session exists; this
divergence is ledgered in `PARITY.md`.

## Rules common to every gate

1. **A gate parks the Drain.** The current Drain finishes when the gate opens;
   choosing an outcome that resumes AFK work begins a fresh Drain (doc 03). The
   Implement run owns the gate; the Drain never does.
2. **The human decides every outcome.** Ported partial, verbatim in force for
   the orchestrator at every gate: the orchestrator effects no disposition — no
   task status change (complete, skip, reset, reopen), no verdict recorded, no
   accept, no remediation spawned — *even when the human has told it which
   outcome they want*. The human effects the disposition by answering the gate's
   structured ask; the orchestrator applies the chosen outcome's file writes
   only as the direct execution of that answer.
3. **The orchestrator may draft what the human confirms.** A task body, a
   remediation task, a manifest edit, or implementation edits under the checkout
   are all fair to *prepare* when the human asks — preparing an artifact is not
   deciding the outcome. Drafts are named plainly; the transition waits for the
   gate answer. New work created at a gate follows the authoring contract
   (doc 01) and is validated the way `/cook:register` validates; creating work
   completes, skips, accepts and remediates **nothing**.
4. **Every gate offers exit.** Leaving the gate changes no task state and makes
   no disposition; the set keeps its derived status and the gate reopens on the
   next `/cook` of the set.
5. **Non-interactive fallback (dormant).** Cook v1 is attended-only (ADR-0004).
   The defined behavior for any future headless mode is pop's: **stop and
   report** the gate, its blocking item, and the allowed outcomes — never
   auto-decide.

## HITL gate

**Opens when** the drain needs a HITL task resolved: either the set is BLOCKED
(an open AFK task is gated behind a human task) or the set is
AWAITING-APPROVAL and only the terminal sign-off remains. On the sign-off case
the gate opens **after** verification passed (doc 06) and the review exists
(doc 07).

**The ask shows**: the blocking HITL task's full body; the task-set listing;
the completed-AFK-work summaries from `progress.txt` (what the agents actually
did, in their own SUMMARY blocks); the review pointer (path + commit +
out-of-date flag — never the body).

**Allowed outcomes**:
- **complete** — the human verified the required work; the task transitions to
  done. If this was the last open task, the set is DONE.
- **defer** (skip) — the human skips the HITL task; downstream `blocked_by`
  dependents unblock (a skipped prerequisite satisfies), and the set derives
  DEFERRED. Skipping is not completing: the journal records SKIP.
- **edit and rerun** — the human (with the orchestrator drafting) edits tasks
  or implementation state, then re-invokes `/cook` on the set.
- **exit** — leave the task open, no disposition.

## Failed gate

**Opens when** a task exhausted `max_tries` (doc 05) and transitioned to
failed.

**The ask shows**: the failed task's body; the structured failure reason from
the last attempt (or "no structured failure reason was recorded"); the task-set
listing; the review pointer when one exists.

**Allowed outcomes** (the only two, ported verbatim):
- **re-run** — fix the underlying problem so a fresh attempt can pass: the
  orchestrator helps the human repair the checkout or sharpen the task body,
  then the task is reopened. Reopening writes a **RESET marker** to the journal
  with a timestamp — this is the cut the retry digest scopes to (doc 05): prior
  attempts are excluded and the attempt counter restarts. The human then
  re-invokes `/cook` to retry AFK.
- **complete by hand** — the human finishes the task's work directly and marks
  the task done (recorded as a human completion; doc 06's suspension rule
  applies to it).
- **exit** — leave the task failed, no disposition.

## Verify-failed gate

**Opens when** the Verifier returned NEEDS-HUMAN, or FIXABLE with the
remediation depth cap exhausted (doc 06).

**The ask shows**: the recorded Verifier findings (or "none were recorded for
this verdict"); the commit range and complete `git diff --stat` (fetch any
file's diff on request); the task-set listing; the review pointer.

**Allowed outcomes**:
- **accept** — the human records a **human-authored PASS** with an optional
  note. The PASS is cached like an agent PASS (episode immunity applies). The
  note is persisted in `state.json` and fed to every future Verifier of this
  set as the **prior human note** prompt section: the adjudicated non-issue is
  not re-flagged, but a genuine new regression still fails.
- **remediate** — the human spawns a remediation task (origin `human`) carrying
  the findings and an optional note. This is the one outcome the orchestrator
  is expected to **pre-draft**: it writes the remediation task from the
  findings and offers the draft for confirmation instead of making the human
  retype it. Spawning invalidates cached verdicts and the next `/cook` drains
  it; human-origin remediation does not count against the depth cap's exhausted
  state — the human's explicit choice overrides the cap.
- **exit** — leave the set VERIFY-FAILED, no disposition.

**Not offered**: re-running the Verifier. That is a separate force action
(`/cook:verify`), not a response to findings — a gate that offers "ask again"
invites verdict-shopping.

## Interrupt gate

**Opens when** a live attempt was cut off mid-run by the human's interrupt
(the in-agent analog of pop's SIGINT on a drain).

**The ask shows**: the interrupted task's full body; the task-set listing; the
review pointer when one exists.

**Allowed outcomes**:
- **continue draining** — re-run the interrupted task; a fresh Drain begins.
- **exit** — leave the task open, no disposition.

The interrupted attempt is recorded in its attempt record with outcome
`interrupted` — it consumes a try, and the digest gives the next attempt the
*resume* lesson (doc 05): the checkout already holds the partial changes; read
the working-tree diff first.

The orchestrator at this gate advises and edits by hand only; it never resumes
the drain itself — the human chooses through the ask.

## Sources in pop

- `tasks/gates.go` (HITL gate + assistance), `tasks/interrupt_gate.go`,
  `tasks/run_tasks.go` (Failed gate), `tasks/verify_phase.go` (Verify-failed
  gate and dispositions)
- `tasks/prompts/hitl-assistance.tmpl.md`, `failed-assistance.tmpl.md`,
  `verify-failed-assistance.tmpl.md`, `interrupt-assistance.tmpl.md`,
  `partials.tmpl.md` (the-human-decides, you-may-draft-what-the-human-confirms)
  — all ported in doc 09
- `CONTEXT.md` — **HITL gate prompt**, **Failed gate prompt**, Verify-failed
  entries, **Remediation task** (origins), **Human completion**, the
  stop-and-advice non-interactive rule
