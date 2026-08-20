# 07 — The Reviewer

An independent Reviewer writes a code review of everything the set changed —
naming, structure, cohesion, idiom, comments, tests. It answers *how well the
code is written*; the Verifier (doc 06) answers *whether it does what was
asked*. The two must not duplicate each other, and the Reviewer's prompt says so.

**Non-gating by design.** The Reviewer reaches no verdict — no PASS, FAIL,
APPROVE, or rating — and nothing it writes changes any state: no task
transition, no verdict cache entry, no gate. Its whole output is one document a
human reads and acts on or ignores. Review is **on by default** in cook
(`review: true` in `.cook/config.json`); turning it off removes the automatic
run only — `/cook:review` still works.

## When it runs

- **Automatically**, in the drain tail, **after a PASS verdict** (or, with
  `verify: false`, on terminal arrival), when `review` is true and the review
  episode (below) requires one. Order matters: the review the human reads at the
  sign-off gate describes work that already verified.
- **Manually**, via `/cook:review <set-id>`: always writes a fresh review.

## How it runs

A **fresh-context subagent** under the Reviewer prompt (doc 09), given:

- The commit range `<set-base>..HEAD` and a **complete** `git diff --stat` —
  bodies never inlined; the subagent stands in the checkout under review and
  opens what it decides to look at (`git diff`, `git log --oneline`,
  `git show`). The prompt tells it a review written from the stat table alone
  is worthless: naming, structure and idiom are not visible in file names and
  line counts.
- The set's task list (ids and titles only — orientation, not criteria).
- The optional `spec.md`, marked context-only.
- **The previous review**, when one exists: the new Reviewer is told it writes
  the document that **replaces** the one it was given, not an appendix — carry
  forward what is still true, drop what the code has since fixed, say what
  changed. A reader takes only the new document.

### No convention in cook v1

Pop resolves a per-repository code-review convention and hands it to the
Reviewer as the standard to hold the changeset against. Cook v1 ships no
convention machinery; the prompt's convention branch is **dormant** and the
**derive-as-you-read** branch is always taken: judge against the surrounding
code's own idiom, its linter and formatter configuration, and any standards
written into its documents; never import a house style; say plainly where a
standard was inferred rather than read.

## Output

A Markdown document starting at a `## ` heading — no preamble, no sign-off, no
verdict line — ordered by how much each point matters, each point naming file
and line, what is wrong, and what the Reviewer would do instead. A well-written
changeset earns one sentence saying so, and the review stops there.

Written to:

```
.cook/tasks/<set-id>/reviews/<ISO-8601-timestamp>.md
```

The latest by timestamp is *the* review. Older reviews stay on disk as history;
nothing reads them except a human.

## The review episode

Reviews are deduplicated by a fingerprint in `state.json`, parallel to the
verification episode but keyed independently:

```
review_fingerprint = sorted ids of currently-done AFK tasks, joined with ","
```

- A commit that only moves the work SHA — same done-AFK composition — does
  **not** re-review.
- A newly finished task changes the fingerprint and warrants a fresh review; a
  finished **remediation task** counts exactly like any other.
- The automatic drain-tail run is skipped when the current fingerprint already
  has a review; `/cook:review` ignores the fingerprint (force).

## The review pointer

Surfaces never inline the review body — they carry a **pointer and a verb**:

- the document's path,
- the commit it was written against (recorded in the document's own header),
- an **out-of-date** flag when HEAD has moved past that commit ("parts of it may
  describe files as they no longer are; check what changed since before acting
  on a finding").

The pointer is rendered at the **HITL sign-off gate** (doc 08) — so the human
can read the review before signing off — and by `/cook:status` detail for the
set. Acting on a finding is the human's call; the gate prompt says the review
"reaches no verdict and gates nothing".

## Sources in pop

- `tasks/review.go` — Reviewer invocation, range + complete stat, the
  ReviewConvention seam (ported dormant)
- `tasks/review_phase.go` — the drain's review step (fires after verify, gates
  nothing), `tasks/review_episode.go` — the done-AFK-ids fingerprint,
  `tasks/review_pointer.go` — path + commit + out-of-date, rendered at the gate
  and in status detail
- `tasks/prompts/reviewer.tmpl.md` — the prompt (ported in doc 09)
- `CONTEXT.md` — Reviewer/Code review entries; **Review episode**; **Review
  pointer**
- `docs/adr/0214` (code review: same range/stat as verify, told to open files
  itself, artifact under `<set>/reviews/`, latest by timestamp)
