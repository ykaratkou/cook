# One attempt: spawn, assessment, commit

## Before the spawn

1. Check the retry cap (`retry.md`): the task's manifest `attempts` counter
   must be below `max_tries`.
2. **Persist the counter first**: increment the task's `attempts` in
   `manifest.json` **before** the spawn — one write through the cook-state
   read and mutation capability (ground rule 4; your host's delivery note
   names the mechanism). The counter on disk is the enforcement — a
   re-entered drain resumes it, never resets it.
3. Render the implementer prompt (`prompts/implementer.md`) with:
   - `{{task_path}}` — the task's markdown file
   - `{{manifest_path}}` — the set's `manifest.json`
   - `{{tasks_dir}}` — the set directory
   - `{{runtime_path}}` — the checkout the work happens in
   On attempt ordinal > 1, append the prior-attempt digest (`retry.md`).

## The spawn

One fresh-context subagent — spawned per your host's delivery note
(host-claude-code.md or host-pi.md) — with the rendered prompt as its task
text. Its captured output is the attempt's result; parse it, never speak to
the subagent again. A spawn that fails outright (spawn error, subagent never
ran) consumes no attempt — decrement the counter back.

Forbidden to the subagent (stated in its prompt, enforced by your assessment
and by owning the commit step): modifying `manifest.json`, modifying any task
file other than its own, making git commits. Its only legitimate writes are
implementation edits under the runtime checkout and ticking the acceptance
boxes in its own task file.

## The completion contract

The attempt's output must end with either:

```
SUMMARY_START
<one or more lines describing what was done>
SUMMARY_END
TASK_COMPLETE
```

or, as the final line: `TASK_FAILED: <one-line reason>`.

## Assessment — before anything is finalized

On output ending in `TASK_COMPLETE`, assess in order:

1. **Sentinel present** — a line opening on `TASK_COMPLETE`. Absent →
   attempt failed, reason `missing-sentinel`.
2. **Summary present** — a non-empty `SUMMARY_START…SUMMARY_END` block.
   Absent or empty → attempt failed, reason `missing-summary`.
3. **Boxes ticked** — re-read the task file; every checkbox under
   `## Acceptance criteria` must be `- [x]`. Any `- [ ]` remaining → attempt
   failed, reason `unchecked-boxes`, even when the work itself landed.
4. An output with no parseable content at all → reason `empty-output`.

These four reason strings are **contract failures**: harness-recorded, as
distinct from the agent's own `TASK_FAILED` text. The distinction drives the
lessons table (`retry.md`) — a contract failure keeps the approach and
continues; the agent's own failure text pivots.

`TASK_FAILED: <reason>` is taken at face value: the attempt failed with the
agent's reason.

An assessment failure does not finalize the task — it charges one try and
re-enters the retry loop. Only an exhausted retry loop finalizes the task as
failed.

## Record the attempt — every started attempt, before anything else

Immediately after assessment (or after observing a crash/interrupt), write
the slim attempt record to `attempts/<task-id>-<ordinal>.json` — **whatever
the outcome, successes included**. The record is a file you create whole
through the cook-state read and mutation capability. Do this *now*, before
the commit and finalize steps: the record is the retry digest's only
substrate, and a successful attempt's record still matters (a later reopen
re-runs the task with its history). The format is below.

## The implementation commit — five steps, in order

The subagent never commits; you do, after assessment passes:

1. **Assessment first** — no git action before the contract holds.
2. **Change check** — `git status --porcelain` in the runtime checkout. A
   clean tree completes the task as a **No-Op**: marked done, no commit made,
   no commit fields recorded.
3. **The commit** — `git add -A` (under the `continue` dirty strategy this
   deliberately sweeps pre-existing dirty state in with the agent's work),
   then unstage cook's own transient lock —
   `git reset -q -- .cook/tasks/<set-id>/drain.lock` — a live drain's lock
   never belongs to an implementation commit. Then one commit with three
   `-m` paragraphs:
   - **Subject**: the task's `commit_subject` from the manifest, verbatim,
     when present; else the default `cook(<set-id>): <task-id>`.
   - **Body**: the agent's SUMMARY block, verbatim.
   - **Trailer**: `Cook-Task: <set-id>/<task-id>`, in its own `-m` paragraph
     so git parses it as a real trailer. Derive it here, in the commit step,
     so no caller can forget it — the trailer is how commits trace back to
     tasks.
   Apply config `commit_overrides` entries as `git -c` pairs to this commit.
4. **Range bookkeeping** — `git rev-list --parents -n 1 HEAD` records the new
   SHA and its parent. When `state.json` has no `set_base_commit` yet, this
   commit's parent becomes the **set base commit** — the Verifier/Reviewer
   range is `<set_base_commit>..HEAD` forever after. Store the subject
   verbatim (`commit_subject_used`) so the commit can be re-found by
   fixed-string search after a rebase. A root commit (no parent) records an
   empty base; the range degrades to the whole history.
5. **Finalize** — the task's `status: "done"`, its `commit_sha` and
   `commit_subject_used`, and the reset of transient counters land in **one**
   `manifest.json` write through the cook-state read and mutation capability:
   the done status and the `commit_sha` must land **together**, in that one
   write, never as separate calls (ground rule 4 — your host's delivery note
   names the mechanism that carries several replacements at once). Then
   append the `progress.txt` `DONE` block (summary = the SUMMARY text) — one
   further write through the same capability — in the same finalize step. A
   crash between the git commit and the finalize leaves a commit whose trailer
   names a task still `open` — repaired by re-running the task (its next
   attempt starts from a checkout where the work already exists and completes
   as a No-Op or a trivial delta).

The failure path mirrors it: on retry exhaustion the task goes
`status: "failed"` with its attempt count in the manifest — one write, both
facts together — and a `FAILED` block (summary = the final failure reason) is
appended to `progress.txt` through the same capability.

## The slim attempt record

**Every started attempt** writes one record to
`attempts/<task-id>-<ordinal>.json`, whatever the outcome:

```json
{
  "task_id": "01-first-task",
  "ordinal": 2,
  "outcome": "completed | failed | crashed | timed_out | interrupted | turn_cap_exhausted",
  "failure_reason": "<empty | missing-sentinel | missing-summary | unchecked-boxes | empty-output | the agent's TASK_FAILED text>",
  "summary_tail": "<the last ~12 lines of the attempt's narrative/summary>",
  "at": "<RFC3339>"
}
```

On both current hosts you can observe `completed`, `failed`, `crashed` (the
subagent died without producing output), and `interrupted` (the host
interrupt cancelled the running spawn — per your host's delivery note);
`timed_out` and `turn_cap_exhausted` are Blind — never record what you
cannot observe; record `failed` with the best reason you have. The record exists solely as the retry digest's substrate; it is not
telemetry and carries no raw transcript.

## Journal block format (`progress.txt`)

Append-only, one block per terminal transition:

```
<RFC3339 UTC timestamp> [<task-file>] <OUTCOME>
<summary — one or more lines>
---
```

Outcome markers: `DONE`, `FAILED`, `COMPLETE` (human completed by hand),
`RESET` (human reopened), `SKIP` (human skipped). Set-level events use the
literal task-file `set`.

The journal is append-only: each block lands as one write through the
cook-state read and mutation capability, appended rather than rewritten. Its
timestamp — and the `at` in an attempt record — comes from the RFC3339 UTC
timestamps capability.

## Sources

`docs/spec/04-attempt.md` and `docs/spec/01-storage.md` in the cook
repository (pop sources in their footers).
