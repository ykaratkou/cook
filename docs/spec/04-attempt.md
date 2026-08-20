# 04 — The attempt: contract, assessment, commit

## One attempt

One attempt is **one fresh-context subagent** — spawned with no shared
conversation state, given the implementer prompt (`09-prompts.md`,
"Implementer") with these placeholders filled:

- `{{task_path}}` — the task's markdown file
- `{{manifest_path}}` — the set's `manifest.json`
- `{{tasks_dir}}` — the set directory
- `{{runtime_path}}` — the checkout the work happens in

On attempt ordinal > 1 the prior-attempt digest (`05-retry.md`) is appended
to the prompt. The subagent's **final output is the attempt's result**; the
orchestrator parses it and the subagent is never spoken to again.

Forbidden to the subagent (stated in its prompt, enforced by assessment and
by the commit step's ownership):

- modifying `manifest.json`,
- modifying any task file other than its own,
- making git commits.

Its only legitimate writes are implementation edits under the runtime
checkout and ticking the acceptance boxes in its own task file.

## The completion contract

The attempt's output MUST end with either:

```
SUMMARY_START
<one or more lines describing what was done>
SUMMARY_END
TASK_COMPLETE
```

or, as the final line:

```
TASK_FAILED: <one-line reason>
```

## Assessment

On output ending in `TASK_COMPLETE`, the orchestrator assesses **before**
anything is finalized:

1. **Sentinel present** — a line opening on `TASK_COMPLETE`. Absent →
   attempt failed, reason `missing-sentinel`.
2. **Summary present** — a non-empty `SUMMARY_START…SUMMARY_END` block.
   Absent or empty → attempt failed, reason `missing-summary`.
3. **Boxes ticked** — re-read the task file; every checkbox under
   `## Acceptance criteria` MUST be `- [x]`. Any `- [ ]` remaining →
   attempt failed, reason `unchecked-boxes`, even when the work itself
   landed.
4. An output with no parseable content at all → reason `empty-output`.

These four reason strings are **contract failures**: harness-recorded, as
distinct from the agent's own `TASK_FAILED` text. The distinction drives
the lessons table in `05-retry.md` — a contract failure keeps the approach
and continues; the agent's own failure text pivots.

`TASK_FAILED: <reason>` is taken at face value: the attempt failed with the
agent's reason.

An assessment failure does not finalize the task — it charges one try and
re-enters the retry loop (`05-retry.md`). Only an exhausted retry loop
finalizes the task as failed.

## The implementation commit — five steps, in order

The subagent never commits; the orchestrator does, after assessment
passes:

1. **Assessment first** — steps above; no git action before the contract
   holds.
2. **Change check** — `git status --porcelain` in the runtime checkout. A
   clean tree completes the task as a **No-Op**: marked done, no commit
   made, no commit fields recorded.
3. **The commit** — `git add -A` (under the `continue` dirty strategy this
   deliberately sweeps pre-existing dirty state in with the agent's work),
   then unstage the set's `drain.lock` when present — cook's transient lock
   is orchestration state, never part of an implementation commit. Then one
   commit with three `-m` paragraphs:
   - **Subject**: the task's `commit_subject` from the manifest, used
     verbatim, when present (a *planned* subject); else the default format
     `cook(<set-id>): <task-id>`.
   - **Body**: the agent's SUMMARY block, verbatim.
   - **Trailer**: `Cook-Task: <set-id>/<task-id>`, in its own `-m`
     paragraph so git parses it as a real trailer rather than the body's
     last prose line. Derived here, in the commit step, so no caller can
     forget it — the trailer is how commits trace back to tasks.
   Entries in config `commit_overrides` are applied as `git -c` pairs to
   this commit.
4. **Range bookkeeping** — one `git rev-list --parents -n 1 HEAD` records
   the new SHA and its parent. When `state.json` has no `set_base_commit`
   yet, this commit's parent becomes the **Set base commit** — the
   Verifier/Reviewer commit range is `<set_base_commit>..HEAD` forever
   after. The subject is stored verbatim (`commit_subject_used`) so the
   commit can be re-found by fixed-string search after a rebase changes its
   SHA. A root commit (no parent) records an empty base, and the range
   degrades to the whole history.
5. **Atomic finalize** — the task's `status: "done"`, its `commit_sha` and
   `commit_subject_used`, and the reset of transient counters land in one
   atomic `manifest.json` write (temp + rename); the `progress.txt` `DONE`
   block (summary = the SUMMARY text) is appended in the same finalize
   step. A crash between the git commit and the finalize leaves a commit
   whose trailer names a task still `open` — detectable, and repaired by
   re-running the task (its next attempt starts from a checkout where the
   work already exists and completes as a No-Op or a trivial delta).

The failure path mirrors it: on retry exhaustion the task goes
`status: "failed"` with its attempt count in the manifest, and a `FAILED`
block (summary = the final failure reason) is appended to `progress.txt`.

## The slim attempt record

**Every started attempt** writes one record to
`attempts/<task-id>-<ordinal>.json`, whatever the outcome:

```json
{
  "task_id": "…",
  "ordinal": 2,
  "outcome": "completed | failed | timed_out | interrupted | turn_cap_exhausted",
  "failure_reason": "<empty | missing-sentinel | missing-summary | unchecked-boxes | empty-output | agent's TASK_FAILED text>",
  "summary_tail": "<last ~12 lines of the attempt's summary or narrative>",
  "at": "<RFC3339>"
}
```

`timed_out`, `interrupted`, and `turn_cap_exhausted` are recorded only on
hosts whose capability matrix (`10-hosts.md`) lets the orchestrator observe
them; a host that cannot distinguish them records `failed` with the best
reason it has. The record exists solely so the retry digest
(`05-retry.md`) has inputs; it is not telemetry.

## Sources in pop

- `tasks/prompts/agent.tmpl.md` — the contract's prompt half (sentinels,
  boxes, no-commit rule)
- `tasks/attempts.go:457-566` — `completeSuccessfulTask`,
  `runtimeHasChanges`, `ImplementationCommit`, `implementationSubject`,
  `createImplementationCommit` (the five steps, `add -A`, three `-m`
  paragraphs, `rev-list --parents`)
- `tasks/attempts.go:568-600` — `finalizeTaskFailed` / `finalizeTaskDone`
  through the transition chokepoint
- pop ADR-0207 (planned commit subjects; set base commit; fixed-string
  re-find after rebase), ADR-0216 (the trailer derived inside the commit),
  ADR 0020 (failure reason owned by the durable record)
- Cook divergences: trailer key `Cook-Task:`; default subject format
  `cook(<set-id>): <task-id>`; slim attempt records replace Captured runs.
  See `PARITY.md`.
