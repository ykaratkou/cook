# 07 — Refine

**Refine** holds a set's accumulated changeset to the repository's
**Implementation convention**. A fresh **Refiner** studies the changeset, fixes
in place what its licence allows, and writes the **Refine report**. The
orchestrator then commits the pass's fixes as one **Refine commit**. Refine
answers *how well the code is written* and improves it. The Verifier (doc 06)
answers *whether it does what was asked*, and the Refiner's prompt keeps the two
apart.

Refine replaced cook's read-only Reviewer, following pop (ADR-0013, porting pop
ADR-0252/0246/0247/0248). Two things stay from the Reviewer:

- **It gates nothing.** The Refiner reaches no verdict and spawns no task. No
  outcome of the phase parks the set or changes its terminal status: a set
  reaches exactly the status it would reach with Refine switched off.
- **It is on by default** (`refine: true` in `.cook/config.json`). Pop defaults
  it off, so this is a marked divergence, and it amends ADR-0005. Cook's Verifier
  is also on by default and runs *after* Refine, so every Refine commit is
  judged. Turning `refine` off removes the automatic run only; `/cook:refine`
  still works.

## When it runs

- **Automatically**, in the drain loop's refine phase. This is the first phase
  step, run **before** the verify phase (doc 03). A pass's edits are code like any
  other and need judging. Because Refine runs first, the Verifier that was about
  to read this changeset reads the refined one instead, and the pass needs no
  verification of its own. The automatic run fires when all of these hold:
  1. `refine` is true;
  2. the set is in the **terminal zone** (DONE or AWAITING-APPROVAL, doc 02);
  3. the terminal state was not reached through a task carrying
     `human_completed`. The drain does not edit code a human declared done.
     Editing it directly would intrude further than the verdict dispositions the
     same bit already suspends;
  4. the **Refine episode** (below) is armed;
  5. the set has **refinable work** and a **clean tree** (both under
     "Preconditions").
- **Manually**, via `/cook:refine <set-id>`: a full pass on any set with
  refinable work. That includes a set mid-drain, one parked at VERIFY-FAILED,
  a human-completed one, and one already DONE. It ignores `refine`, the
  human-completion skip, and the episode. It takes `drain.lock` like a drain and
  refuses on a fresh one (doc 03). A Refiner reading files a drain is rewriting
  would judge a tree that never existed.

**Nothing here gates.** In the automatic phase, a skipped precondition, a spawn
error, or a reply that produces no report is printed in one line
(`Refine did not run for <set-id>: <why>`) and dropped. The episode stays armed,
so the next standstill asks again. The only thing that ends the drain here is
the human's interrupt. The drain then exits, the interrupt is reported, and no
gate opens (the Interrupt gate belongs to a task's attempt). The Refiner's
partial edits are left uncommitted in the working tree, and the exit report says
so.

## Preconditions

- **Refinable work.** The set has at least one done AFK task, and its commit
  range `<set_base_commit>..HEAD` is known and non-empty. Without them there is
  nothing to hold to a standard, and refining a guessed range would judge other
  people's code.
- **Clean tree outside `.cook/`.** `git status --porcelain -- . ':(exclude).cook'`
  must be empty when the pass begins. This is a **cook divergence**. Pop
  snapshots whatever dirt the tree holds (`git stash create`) so that an
  abandoned pass can restore it exactly. Cook keeps its task storage inside the
  checkout, and a whole-tree restore would roll back or delete the files the pass
  itself just wrote under `.cook/`. So cook restores with a pathspec that
  excludes `.cook/`, and starting clean is what lets that restore return the tree
  exactly as found. At a standstill the tree outside `.cook/` is clean in the
  ordinary case, because every task commit is `git add -A`. The forced verb
  refuses on dirt and shows `git status`.

## How it runs

One pass follows the same steps whether it is automatic or forced:

1. **Mark the start.** Write `refine_last: { "outcome": "started",
   "work_sha": <HEAD>, "at": <now> }` to `state.json` in one write. If the pass
   dies or is interrupted, the `started` record is what remains, and the
   **Refine mark** reads it as interrupted.
2. **Spawn the Refiner**: a fresh-context subagent under the Refiner prompt
   (doc 09). Its inputs:
   - the commit range and a **complete** `git diff --stat`. Bodies are never
     inlined; the Refiner stands in the checkout and opens what it needs
     (`git diff`, `git log --oneline`, `git show`, `git show <base>:<file>`);
   - the task list, as ids and titles;
   - the optional `spec.md`;
   - **the previous Refine report**, when one exists. The new Refiner writes the
     report that *replaces* it: it replaces **Fixed** and **Left in this
     changeset**, carrying forward what is still true, and never carries forward
     **Revealed by this changeset**;
   - the resolved **Implementation convention**, as a labelled block;
   - the **Overlay** on the refine step, when one exists;
   - the **path** of the resolved **Verification convention**. It is
     role-driving, so the Refiner reads it itself to learn how to run the scoped
     gate before and after its edits.
3. **Parse the reply.** Scan the lines before the reply's first Markdown heading
   (`#`) for the machine-read channel lines:
   - `REFINE-OUTCOME: refined | gate-blocked | abandoned`. Markdown decoration
     and `REFINE OUTCOME` / `REFINE_OUTCOME` spellings are tolerated, but a colon
     is required. A recognised line is always lifted out of the report. A missing
     line, or a value that is not one of the three tokens, is read as `refined`.
     That is the same trust model as `VERDICT:`: the outcome is self-reported,
     and the verify phase catches a lie one step later.
   - `COMMIT-SUBJECT:` is **dormant**. Cook v1 configures no commit convention,
     so the line is lifted and ignored.

   What remains is the report body.
4. **Write the Refine report** (below) in one write, **before** any git action,
   so a git failure cannot lose the only account of what the pass did.
5. **Act on the outcome:**
   - **gate-blocked**: the scoped gate was already red on entry. Commit
     nothing, touch nothing.
   - **abandoned**: the gate went red under the Refiner's own edits. Discard
     them, never touching `.cook/`:
     `git restore --source=HEAD --staged --worktree -- . ':(exclude).cook'`
     then `git clean -fd -- . ':(exclude).cook'`. Commit nothing.
   - **refined**: when anything outside `.cook/` changed, make the **Refine
     commit**. `git add -A`, unstage the set's `drain.lock` when present, then
     make one commit with two `-m` paragraphs:
     - **Subject** `cook(<set-id>): refine`;
     - **Trailer** `Cook-Refine: <set-id>`, in its own paragraph so git parses
       it as a trailer.

     `commit_overrides` apply as `git -c` pairs. A pass that fixed nothing
     commits nothing, because an empty commit would claim a refinement on a tree
     identical to its parent. `.cook/` changes are swept into the commit the
     same way they are swept into an implementation commit (doc 04). The Refine
     report is one of them.
6. **Record.** Make one `state.json` write that sets `refine_last` to the parsed
   outcome and, **only on `refined`**, stores the Refine episode fingerprint.

The Refine commit does not invalidate a prior PASS. Within a verification
episode a PASS stands and the `verified at <sha>` annotation shows the drift, as
for any commit past a PASS (doc 06). In the automatic flow the question does not
arise, because Refine runs before verify.

## The conventions

Pop resolves each **Convention kind** through a **Convention stack** that
always answers: the first rank holding something wins, and pop's **Shipped
convention** is the last rank. Cook ports two ranks of it (a marked divergence;
pop's per-user ranks under `~/.agents/docs/` are OUT):

1. the repository's `docs/agents/<kind>.md`, when present and non-empty;
2. cook's shipped text, `conventions/<kind>.md` at the plugin root. This is
   pop's shipped answer with the edits recorded in doc 09.

The resolution is winner-take-all, not composition. Two kinds are used:

- **`implementation`**: what good code looks like here, with code and tests as
  one subject. The Refiner always gets it as a labelled block. The implementer
  gets it only when `include_implementation_convention` is true (default
  false). The Verifier never does: a quality standard in the hands of the one
  role that can fail a set turns taste into VERIFY-FAILED.
- **`verification`**: how work is checked. It is role-driving: it is the body of
  the Verifier's "How work is checked in this repository" section (doc 06), and
  the Refiner reads it by path for its scoped gate.

The refine step's **procedure** is not a convention. It is the prompt, and no
rank can replace it. A repository steers it with an **Overlay**:
`docs/agents/refine.overlay.md`, appended as the prompt's "Overlay on this step"
section when present and non-empty. (Pop's per-user overlay rank is OUT.)

## The Refine report

Written to:

```
.cook/tasks/<set-id>/refine/<ISO-8601-timestamp>.md
```

The orchestrator stamps a header, then leaves one blank line and places the
reply's report body below it:

```markdown
# Refine report — <set-id>

- Refined: <RFC3339 UTC>
- Commit range: <set_base_commit>..<work sha>
- Work SHA: <short HEAD sha read before the spawn>
- Refiner: claude-code
```

The body has three parts, in order: **Fixed**, **Left in this changeset**, and
**Revealed by this changeset**. The latest by timestamp is *the* report. Older
reports stay on disk as history, so a superseded revealed finding is unpointed
rather than lost. A set's pre-Refine `reviews/` directory is left alone as
history, and nothing reads it.

## The Refine episode

The Refine episode deduplicates automatic passes. It is a fingerprint in
`state.json`, parallel to the verification episode but keyed differently:

```
refine_episode_fingerprint = sorted ids of currently-done AFK tasks that are
                             not Remediation tasks, joined with ","
```

- It is **armed** when the stored value is absent or differs from the
  recomputed one, and the recomputed one is non-empty.
- **Remediation tasks are left out** (they carry `origin`, doc 01). A verify →
  FIXABLE → remediate → re-verify lap therefore re-verifies without re-refining,
  which keeps the heavy pass out of the iteration that must be cheapest. The
  price is that a remediation diff lands unrefined until real new work re-arms
  the episode, and ADR-0013 accepts that trade.
- It is recorded **only on a `refined` outcome**, by the drain and by
  `/cook:refine` alike. A `gate-blocked` or `abandoned` pass leaves it armed:
  the episode means "this composition has been refined", and a transient red
  gate must not cost the set its pass for good.

## The Refine mark

The Refine mark records whether a terminal set's changeset was held to the
standard at all. It sits beside the status the way the verification mark does,
and it **gates nothing**. It is derived read-only from `refine_last`, only when
`refine` is true and the set is in the terminal zone:

| `refine_last` | Mark as a human reads it |
|---|---|
| absent | Not refined *(reason: never ran)* |
| `started` | Not refined *(reason: interrupted)* |
| `refined` | Refined |
| `gate-blocked` | Not refined: the scoped gate was already red when the pass began |
| `abandoned` | Not refined *(reason: abandoned)* |

The words above are the ones shown. Only the gate-blocked reason is spelled out,
because it is a fact about the work, not about the pass. It is rendered at the
HITL sign-off gate, in `/cook:status` detail, and in the drain's exit report.

## The Refine pointer

Surfaces never inline the report body. They carry a **pointer**:

- the document's path;
- the commit it was written against, read from the header's `Work SHA` (and
  `Commit range`);
- an **out-of-date** flag when HEAD no longer matches that SHA. A Refine commit
  itself moves HEAD past it, and staleness is tolerated: a report of a tree that
  has since moved is still worth reading.

The pointer renders through the `latest-refine-report` partial (doc 09) at every
gate, in `/cook:status` detail, and in the exit report. Acting on a finding the
Refiner left is the human's call; the partial says the report "reaches no
verdict and gates nothing".

## Configuration

- `refine` (default **true**): run the refine phase automatically.
- `include_implementation_convention` (default false): inline the resolved
  Implementation convention into every implementer prompt, planned tasks and
  Remediation tasks alike. It is independent of `refine`.
- The retired `review` key is a **load-time error** naming `refine`, never a
  silent alias. A boolean whose removal changes behaviour must say so. This is
  pop's rule for its own renamed keys.

## Sources in pop

- `tasks/refine_phase.go`: the drain's refine step, before verify; the
  terminal-zone, human-completion and episode skips; failures reported and
  dropped
- `tasks/refine.go`: pass flow, refinable-work gate, report written before
  commit or discard, episode recorded only on refined
- `tasks/refine_commit.go`: `splitRefinerReply`, the outcome tokens,
  `commitRefinePass`, snapshot and discard (ported with the `.cook/` pathspec
  divergence)
- `tasks/refine_episode.go`: the non-remediation fingerprint
- `tasks/refine_mark.go`: the mark, its reasons and wording
- `tasks/refine_pointer.go`, `tasks/pass_report.go`: the header, the pointer,
  staleness
- `tasks/prompts/refiner.tmpl.md`: the prompt (ported in doc 09)
- `conventions/shipped/implementation.md`, `conventions/shipped/verification.md`:
  the shipped answers (ported in doc 09)
- `CONTEXT.md`: **Refine**, **Refiner**, **Refine report**, **Refine outcome**,
  **Revealed finding**, **Refine episode**, **Refine mark**, **Refine pointer**,
  **Refine commit**, **Implementation convention**, **Convention stack**,
  **Shipped convention**, **Overlay**
- pop ADR-0252 (refine fixes in place before verify), ADR-0246
  (Implementation convention), ADR-0247 (procedure is pop's, steered by
  overlay), ADR-0248 (reversibility licence, outcome line, three-part report),
  ADR-0260 (Refine mark), ADR-0226 (a convention always answers)
- Cook divergences: default on; clean-tree precondition with a
  `.cook/`-excluding restore; two convention ranks; the mark derived from
  `state.json` instead of Captured runs; the `drain.lock` hold on the forced
  verb (pop's checkout admission is deferred). See `PARITY.md`.
