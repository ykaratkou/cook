# The review phase

An independent Reviewer writes a code review of everything the set changed —
how well the code is written, not whether it works (the Verifier answers
that). **Non-gating by design**: it reaches no verdict, and nothing it writes
changes any state — no task transition, no verdict cache entry, no gate.
Review is **on by default** (`review: true`); turning it off removes the
automatic run only.

## When the automatic run fires

In the drain loop's review phase, **after a PASS verdict** (or, with
`verify: false`, on terminal arrival), when `review` is true and the review
episode requires one:

1. Recompute the review fingerprint: the sorted ids of currently-done AFK
   tasks joined with `,` (the same identity encoding as verification's,
   stored independently as `review_episode_fingerprint`).
2. If it matches the stored fingerprint, a review of this work already
   exists — skip; the current document still describes this work.
3. Otherwise spawn the Reviewer and store the new fingerprint.

Order matters: the review the human reads at the sign-off gate describes work
that already verified. The only thing that stops the flow here is the human's
interrupt; whatever the review says, the loop continues.

## Force mode (`/cook:review <set-id>`)

Always write a fresh review, ignoring the fingerprint.

## Assembling the prompt

Render `prompts/reviewer.md` (rules in the drain SKILL.md) from:

- The commit range `<set_base_commit>..HEAD` and a **complete**
  `git diff --stat` — bodies never inlined; the subagent opens what it
  decides to look at.
- The set's task list (ids and titles only — orientation, not criteria).
- The optional `spec.md`, marked context-only.
- **The previous review**, when one exists (latest by timestamp): the new
  Reviewer writes the document that replaces it, not an appendix.

The convention branch never renders in v1; the no-convention
(derive-as-you-read) branch always does.

## Output

The subagent's return value is a Markdown document starting at a `## `
heading — no preamble, no sign-off, no verdict line. Write it to:

```
.cook/tasks/<set-id>/reviews/<ISO-8601-timestamp>.md
```

Prepend a small header comment recording the commit it was written against
(e.g. `<!-- reviewed-at: <sha> -->`) — the review pointer reads it. The
latest by timestamp is *the* review; older ones stay as history.

## The review pointer

Surfaces never inline the review body — they carry a pointer and a verb:

- the document's path,
- the commit it was written against (from the document's header),
- an **out-of-date** flag when HEAD has moved past that commit ("parts of it
  may describe files as they no longer are; check what changed since before
  acting on a finding").

Render the pointer at the HITL sign-off gate and in `/cook:status` detail.
Acting on a finding is the human's call; the review "reaches no verdict and
gates nothing".

## Sources

`docs/spec/07-review.md` in the cook repository (pop sources in its footer).
