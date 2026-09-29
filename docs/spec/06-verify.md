# 06 — Agent verification

An independent Verifier judges a set's completed AFK work against its acceptance
criteria. Verification is **on by default** in cook (`verify: true` in
`.cook/config.json`) — a deliberate departure from pop, which defaults it off;
the departure is ledgered in `PARITY.md`.

## When it runs

- **Automatically, at the drain tail**, whenever the set enters the **terminal
  zone** — manifest-derived DONE (only done tasks) or AWAITING-APPROVAL (no open
  AFK work, only HITL sign-off left) — and `verify` is true.
- On an AWAITING-APPROVAL set it runs **before** the HITL sign-off gate opens:
  cheap agent checking precedes expensive human time. A PASS opens the gate.
- **Manually**, via `/cook:verify <set-id>` — a **Forced verification**
  (below): always spawns a fresh Verifier, regardless of any cached verdict.
  Force is the human's escape hatch; the cache governs only *automatic* runs.

## How it runs

A **fresh-context subagent** (doc 10) — zero shared conversation state with the
implementer or the orchestrator — under the Verifier prompt (doc 09). The
orchestrator assembles the prompt from:

- The set id and the current work SHA.
- The **done AFK task bodies with their acceptance criteria** — and only those.
  Open AFK tasks and HITL tasks (any status) are deliberately omitted so the
  Verifier never fails a set on work it isn't equipped to judge; a
  not-yet-run HITL sign-off is not an unmet criterion.
- The commit range `<set-base>..HEAD` (doc 04 records the set base at the first
  implementation commit) and a **complete** `git diff --stat` for it. Diff
  **bodies are never inlined**: the subagent runs in the checkout under
  verification and fetches exactly the file diffs it decides to judge
  (`git diff <range> -- <path>`). This is context economics, ported as design.
- The optional co-located `spec.md`, marked context-only.
- The **prior human note**, when a Verify-failed gate's *accept* outcome
  recorded one (doc 08): marked "context only — a real regression here still
  fails"; the adjudicated non-issue is not re-flagged, but the note does not gag
  the verdict.
- The **remediation history**, when remediation tasks have already run in this
  set, so the Verifier knows what was already tried.
- The resolved **Verification convention** (doc 07, "The conventions") — the
  repository's `docs/agents/verification.md`, else cook's shipped
  `conventions/verification.md` — as the body of the prompt's "How work is
  checked in this repository" section. The stack always answers, so the
  section always renders. It is role-driving: what it takes to believe the
  work is sound is the repository's, while the acceptance-criteria-are-
  authoritative rule and the done-AFK scope stay the prompt's own frame.

## The verdict

The Verifier's reply is parsed structurally:

```
VERDICT: PASS | FIXABLE | NEEDS-HUMAN        (first line, required)
SUMMARY: <one line, what needs fixing>        (optional; omitted on PASS)
FINDINGS: <what was checked, and why each criterion is met or unmet>
```

FINDINGS is written on **every** verdict, PASS included: everything after the
verdict line is published as the **Verify report** (below), and a PASS that
records nothing leaves the human who later asks *why* nothing to read.

`COMMIT-SUBJECT:` — pop emits this line only when a repository commit
convention is configured, and uses it as the remediation commit's subject.
Cook v1 ships **no convention support**; the line is dormant in the prompt and
ignored if produced. Remediation commits fall back to the default subject rule
(doc 04).

A reply whose first line parses to none of the three verdicts is a failed
Verifier attempt, retried under the same `max_tries` cap as implement attempts
(`.cook/config.json`, shared default 3).

## The Verify report

Every Verifier invocation whose reply parsed files one document:

```
.cook/tasks/<set-id>/verify/<ISO-8601-timestamp>.md
```

The orchestrator stamps the header; the body is the reply with its
`VERDICT:` line lifted off the front (when nothing else remains, the whole
reply is kept):

```markdown
# Verify report — <set-id>

- Verified: <RFC3339 UTC>
- Commit range: <set_base_commit>..<work sha>
- Work SHA: <short sha judged>
- Verifier: claude-code

<SUMMARY / FINDINGS as the Verifier wrote them>
```

- One document per invocation, latest by timestamp; a remediation lap leaves
  the whole lap-by-lap trail. Nothing prunes the directory. A failed Verifier
  attempt (unparseable reply) files nothing.
- Filing is best-effort: a failed write is reported as a warning, never a
  failed verification.
- It is written only after a real invocation — a verdict served from the
  cache files nothing.
- It **survives Verification invalidation**: the verdict cache is deleted on
  remediation spawn, while the report is the durable account of why each
  verdict was reached. It answers *why*, never *whether* — staleness stays
  the `verified at <sha>` annotation's question, and the report must not
  offer a second answer to it.
- An **Accepted verdict** (the Verify-failed gate's *accept*, doc 08) files
  one too, rendered by the orchestrator rather than an agent, whose header
  ends `- Accepted by: human` instead of naming a Verifier.

The **Verify pointer** — the report's path and the commit it was written
against, never a line of what it says — renders only where a human reads:
the HITL and Verify-failed gate asks (doc 08), `/cook:status` detail, and the
drain's exit report. It is deliberately **absent from agent prompts**: an
agent sent to fix something already has the findings in its task body, and
the Verifier never reads its own prior reports.

## Disposition — what each verdict does

Ported from pop verbatim:

- **PASS** — cached in `state.json` keyed to the judged work SHA, together with
  the episode fingerprint (below). **PASS immunizes the episode**: no subsequent
  *automatic* Verifier invocation may run while the episode stands — a drain
  re-entering the terminal zone after HITL completion, HEAD drifting past the
  verified SHA on unrelated commits, none of it re-verifies. The terminal verify
  phase becomes a cache lookup; no agent is spawned. The verified-at SHA is
  surfaced by `/cook:status` when HEAD has moved past it.
- **FIXABLE** — findings an agent can resolve. Cook:
  1. spawns a **Remediation task**: a new AFK task file whose body carries the
     findings verbatim (findings live *only* there — never as annotations in
     another task's file), origin `auto`, appended to the manifest;
  2. wires the new task into every open HITL task's `blocked_by`, so sign-off
     waits on the fix;
  3. **invalidates** the cached verdicts (the episode ends — the done-AFK
     composition is about to change);
  4. loops the drain: the remediation task is eligible AFK work and is picked
     up like any other (doc 03). After it drains, re-verification is mandatory —
     a deliberate loop, not a failure retry. (The lap does not re-refine: the
     Refine episode leaves Remediation tasks out, doc 07.)
  Bounded by `remediation_depth` (`.cook/config.json`, default **2**) per set;
  when exhausted, the set parks at the **Verify-failed gate** (doc 08).
- **NEEDS-HUMAN** — the findings need a human decision. The set parks at the
  **Verify-failed gate** immediately; the non-PASS verdict is recorded, and it
  warrants a fresh automatic verify on the next terminal arrival.

### Human completion suspends non-PASS dispositions

When a set's terminal status was reached by a **human completion** (a human
manually completed AFK work — recorded as `human_completed` in the manifest),
every non-PASS disposition is suspended: the verdict still runs, is recorded,
and is printed, but it neither parks the set nor spawns remediation — spawning
fix work would reopen work the human deliberately closed. The finding lands only
as a **verification mark** beside the status (doc 02).

## Forced verification

`/cook:verify <set-id>` is a Verifier run the human starts directly rather
than the tail of a Drain. It takes the set's `drain.lock` for the run and
refuses on a fresh one (doc 03). It always invokes the Verifier, recomputes
the episode fingerprint first (clearing a dead episode's cache exactly as the
drain does), records the verdict at the current work SHA — a PASS also sets
`last_pass` — and files a Verify report. It **enacts nothing on its own**: no
Remediation task is spawned and no set is parked.

- On a **non-PASS** verdict, every one — FIXABLE under the cap included,
  because no drain is present to act on it — the forced run releases the lock
  and ends at the **Verify-failed gate** (doc 08), so the human who asked for
  the judgment dispositions it in the same sitting.
- When the human **exits** that gate, the verdict stays cached and the next
  Drain enacts it under the ordinary disposition: a cached FIXABLE spawns a
  Remediation task without a second Verifier run; a cached NEEDS-HUMAN (or
  FIXABLE with the cap exhausted) parks the set at VERIFY-FAILED. The exit
  says which of those the next drain will do, and adds: *Editing a task's
  acceptance criteria does not clear this verdict; re-run verification or
  record an Accept before the next drain.* — the work SHA does not move when
  criteria change, so without one of the two the next drain remediates stale
  findings.
- On a set whose terminal state was reached through a **human completion**,
  the forced verdict lands only as a verification mark and no gate opens,
  matching the drain.

(Pop's headless branch — printing the disposition block instead of opening
the gate — is dormant: cook v1 is attended-only, ADR-0004.)

## Episodes — when a cached verdict dies

A **verification episode** is one contiguous stretch during which the set's
done-AFK composition is unchanged. Cook implements it as a fingerprint in
`state.json`:

```
episode_fingerprint = sorted ids of currently-done AFK tasks, joined with ","
```

The fingerprint **is** that id list, stored verbatim and compared by string
equality — there is no hash function. Determinism is the requirement (a
re-entered drain must compute the same fingerprint for the same
composition), and the literal id list is deterministic, readable, and needs
no tooling.

- Any AFK task moving **into open** (reopen — the prior judgment covered work
  that no longer stands) or **into done** (new completion, including a
  remediation task finishing; a manually completed AFK body was never judged)
  changes the fingerprint → every cached verdict for the set is invalid → the
  next terminal arrival requires fresh verification.
- **HITL-only transitions never invalidate** — complete, skip, or reopen of a
  HITL task leaves the fingerprint untouched, even when the set detours out of
  the terminal zone through it. The Verifier judges only done-AFK work.
- Invalidation is a hard delete of the cached verdicts in `state.json`, not a
  soft epoch. The journal (`progress.txt`) and the Verify reports are not
  touched — they are history, not cache.

## Sources in pop

- `tasks/verify.go` — Verifier invocation, `workDiffView` (range + complete
  stat, bodies not inlined), verdict parsing, the forced run and its
  disposition text (`handleForcedVerifyFailedGate`,
  `printForcedVerifyDisposition`), `resolveVerificationConvention`
- `tasks/verify_report.go`, `tasks/pass_report.go` — the Verify report, its
  header, the accepted-verdict report, the pointer
- `tasks/verify_phase.go`, `tasks/verify_status.go`, `tasks/verify_mark.go` —
  drain-tail firing, verified-status resolution, the mark
- `tasks/prompts/verifier.tmpl.md` — the prompt (ported in doc 09);
  `conventions/shipped/verification.md` — the shipped Verification convention
- `CONTEXT.md` — **Agent verification**, **Verify verdict**, **Verification
  invalidation**, **verification episode**, **Verification idempotency after
  PASS**, **Verify verdict disposition**, **Remediation task**, **Verified
  status resolution**, **Verify report**, **Verify pointer**, **Forced
  verification**, **Verification convention**
- `docs/adr/0096` (PASS immunizes against later commits), `docs/adr/0109`
  (invalidation fires only on AFK →open/→done), `docs/adr/0179` (human
  completion outranks the verdict), `docs/adr/0245` (verification publishes a
  Verify report), `docs/adr/0227` (the Verification convention is the
  Verifier's role-driving body)
