# 00 — Overview: what cook is

Cook is an **in-agent plugin** that ports pop's task-set *implement* feature —
the drain with its nested loops, the verification tail, the remediation loop,
the code review, and the human gates — into agent hosts that share the
markdown-skills standard. Claude Code is the first host; Pi is the second. Pop
remains the source of truth: cook's documents are continuously ported from the
pop repository, and every document in this set names its pop sources in a
closing footer.

Cook is **docs-first**: this spec set is implementation-binding. A host
implementation is correct when it satisfies these documents, not when it
resembles another implementation.

## Architecture

Pop is an external orchestrator: a standalone binary that spawns agent CLIs as
headless subprocesses, parses their streams, and owns all state. Cook inverts
that:

- **The orchestrator is the human's own agent session**, following the drain
  skill. There is no daemon, no supervisor process, no external binary.
- **Every attempt, Verifier run, and Reviewer run is a fresh-context
  subagent** — a subtask spawned with no shared conversation state, whose
  final output the orchestrator parses. This mirrors pop's
  process-per-attempt isolation exactly.
- **Files are the only truth.** Everything cook knows lives under
  `.cook/` in the target repository (see `01-storage.md`). There is no
  database and no in-memory state worth recovering.
- **Re-entrancy is the crash story.** A drain that crashes, wanders, or is
  interrupted is resumed by invoking `/cook` again: every loop iteration
  re-derives the world from the manifest and sidecar state, so recovery is
  re-entry, not repair.
- **Enforcement is soft.** Pop's supervisor kills runaway attempts from
  outside; a skill can only instruct and record. Caps (`max_tries`,
  remediation depth) are orchestrator-checked before the next spawn. Turn
  caps and timeout kills are declared per host in `10-hosts.md`, Blind where
  the host cannot enforce them — the same capability-declaration pattern pop
  uses across its agent adapters.

## The four nested loops

An implement run comprises four loops, each with its own name and its own
bound. The names are pop's, used verbatim (see the vocabulary note below).

```
Implement run            one /cook invocation, selection to exit
│                        owns: gates, verify phase, review phase
└── Drain                one supervised pass over the set's eligible AFK tasks
    │                    ends at: DONE, FAILED, BLOCKED, AWAITING-APPROVAL,
    │                             VERIFY-FAILED, DEFERRED
    └── Attempt retry loop   up to max_tries attempts per task,
        │                    each retry carries the prior-attempt digest
        └── Turns            model calls inside one subagent attempt;
                             bounded only where the host declares
                             turn-cap enforcement Supported
```

- The **Implement run** holds at most one live Drain at a time. Reaching a
  gate parks the Drain; resuming AFK work begins a fresh one.
- The **Drain** walks eligible AFK tasks until the set reaches a terminal
  disposition. A set may be drained many times across its life.
- The **attempt retry loop** is bounded by `max_tries` (default 3); each
  retry after the first carries the prior-attempt digest so an attempt
  builds on its predecessors instead of rediscovering them.
- **Turns** within one attempt are bounded only on hosts that can enforce a
  turn cap; on all v1 hosts this capability is Blind, and the digest's
  turn-cap lesson stays in the spec, dormant, for the host that can.

There is a fifth, deliberate loop bolted onto the tail: **verification
remediation**. A FIXABLE verdict spawns a Remediation task, the drain picks
it up like any eligible AFK task, and re-verification is mandatory
afterward — bounded by the remediation depth cap, after which the set parks
at VERIFY-FAILED. This is a deliberate loop, not a failure retry.

## The automatic end-to-end flow

One feature, one flow. The human touches it at the front (plan), at gates,
and at sign-off; everything between is automatic.

1. **Plan** — `/cook:plan` interviews, decomposes the feature into a task
   set (small vertical-slice AFK tasks, a terminal HITL sign-off task),
   writes the files, and self-validates until the set derives READY.
2. **Drain** — `/cook` selects the set and runs it: eligible AFK task →
   fresh-context subagent attempt → assessment → per-task commit → next
   task, with the retry loop underneath.
3. **Verify** — when no open AFK work remains, the Verifier fires
   automatically (a fresh-context subagent judging the done work against
   the acceptance criteria over the set's commit range).
4. **Disposition** — PASS is cached and immunizes the episode; FIXABLE
   spawns a Remediation task and loops back to the drain; NEEDS-HUMAN (or
   an exhausted remediation cap) parks the set at the Verify-failed gate.
5. **Review** — after a PASS, the Reviewer fires automatically and writes a
   non-gating code-review document into the set folder. Whatever it says,
   the flow continues; the document is the human's to read.
6. **Sign-off** — an open HITL task opens the HITL gate, with the review
   document pointed to. The human completes or defers it.
7. **DONE.**

On a set with a pending HITL sign-off, verification runs **before** the gate
opens: cheap agent checking precedes expensive human time.

## Command surface

| Command | What it does |
| --- | --- |
| `/cook [set-id]` | The drain. No argument picks the highest-priority READY set. |
| `/cook:plan <feature>` | Author a task set: grill → spec → tickets → self-validated READY. |
| `/cook:register <set-id>` | Validate a hand-authored or hand-edited set; print the fix list or READY. |
| `/cook:status` | Derive and print every set's status and open tasks. Read-only. |
| `/cook:verify <set-id>` | Force the Verifier now, outside the automatic flow. |
| `/cook:review <set-id>` | Force the Reviewer now, outside the automatic flow. |

Host-specific invocation mapping (how `/cook` resolves on Claude Code vs
Pi) lives in `10-hosts.md`.

## Vocabulary

Cook imports pop's glossary verbatim: Drain, Implement run, Attempt, Turn,
AFK task, HITL task, Verifier, Reviewer, Remediation task, verification
episode, and the rest (see `CONTEXT.md` at the repo root). Two rules carry
extra weight:

- **The word "ralph" stays out of cook's vocabulary**, for the same reason
  pop banned it (pop ADR-0190): it names a self-repeating outer loop
  loosely, and importing it would blur which of the four loops is meant.
  What the community calls a *Ralph loop* is cook's **Drain** — say Drain.
- Terms are never paraphrased across docs. A concept renamed is a concept
  forked, and every future port pays the translation tax.

## Reading map

| Doc | Covers |
| --- | --- |
| `01-storage.md` | The format contract: manifest, task files, journal, sidecar state, config. |
| `02-status-derivation.md` | Eligibility, derived set statuses, verification layering, set selection. |
| `03-drain.md` | The Drain and Implement run: loop order, phases, re-entrancy, locking. |
| `04-attempt.md` | The attempt contract: sentinels, assessment, the five-step commit. |
| `05-retry.md` | The retry loop: max_tries, the lessons table, the prior-attempt digest. |
| `06-verify.md` | The Verifier: verdicts, episodes, the remediation loop, invalidation. |
| `07-review.md` | The Reviewer: the non-gating document, review episodes, the pointer. |
| `08-gates.md` | The four gates: HITL, Failed, Verify-failed, Interrupt. |
| `09-prompts.md` | Every prompt verbatim, with cook's marked edits against pop's. |
| `10-hosts.md` | The host capability matrix: Claude Code, Pi. |

The parity ledger — what is IN, what is OUT, every marked divergence, and
the pop commit watermark — is `PARITY.md` at the repo root.

## Sources in pop

- `CONTEXT.md` — glossary entries: **Drain**, **Implement run**, **Task
  retry cap**, **Turn cap**, **Implement**, **Verifier**, **Remediation
  task**, **Verify disposition**
- `docs/adr/0190-a-turn-cap-bounds-one-implementation-attempt-and-only-claude-can-enforce-it.md` — the four nested loops; the "ralph" ban
- `tasks/run_tasks.go` — the drain loop's phase order
- Ported up to the watermark commit recorded in `PARITY.md`.
