# 01 — Storage: the format contract

Everything cook knows lives in files under `.cook/` in the target
repository. There is no database. This document is **the** format contract:
the plan and register skills carry a verbatim copy of the section between
the `format-contract` markers below, and the parity ledger checks that copy
against this document every porting session.

Cook's formats follow pop's *shape* with cook-owned names. Pop's storage
design separates three stores answering three different questions, and cook
keeps that separation because it is a documented, hard-won lesson:

- **State** — `manifest.json`: the current, authoritative truth of each
  task's status. Overwritten on refresh. Holds no history.
- **Journal** — `progress.txt`: an append-only, terminal-grain history of
  distilled outcomes plus summaries. Read by humans and by gate prompts.
- **Digest substrate** — `attempts/`: slim per-attempt records. This is
  *not* telemetry (pop's Captured runs are OUT of cook's scope); it exists
  solely so the retry digest has inputs.

Test — manifest: is-it-true-now (lookup); journal: what-happened-in-order;
attempt record: how-one-attempt-ended.

## Write discipline

Every state change to `manifest.json`, `state.json`, and `progress.txt`
MUST land in **one write** through the **Cook-state read and mutation**
capability (`docs/spec/10-hosts.md`; your Host's Delivery note names the
tools). Never a read-modify-write spread across several calls: one
transition, one write.

**Facts that must land together land in one write.** A task's →done status
and its `commit_sha` live in the same file precisely so a single write
carries both — that is the reason the requirement is expressible at all,
and the reason pi's `edit`, which takes several disjoint replacements per
call, matters.

Cook **does not** guarantee crash-atomic writes. Both hosts' file tools
write in place; neither offers a rename-over-target, so a process killed
mid-write can leave a torn file. What makes that tolerable is the
single-writer discipline: the Orchestrator is the only writer of a set's
files, `drain.lock` is what makes that true, and pi serializes its own file
mutations. The prior read that both hosts' edit tools require is the
stale-read guard ground rule 1 already asks for. The trade — a mechanism no
host can perform, exchanged for a guarantee both can hold — was deliberate;
see `docs/adr/0008-cook-state-uses-the-host-file-mutation-capability.md`
(ADR-0008).

<!-- format-contract-begin -->

## Layout

```
<repo>/
└── .cook/
    ├── config.json                  # cook configuration (optional; defaults apply)
    └── tasks/
        └── <set-id>/                # one directory per task set
            ├── manifest.json        # State: the authoritative task list
            ├── 01-first-task.md     # one markdown file per task
            ├── 02-second-task.md
            ├── ...
            ├── spec.md              # optional: planning spec, context only
            ├── progress.txt         # Journal: append-only outcome history
            ├── state.json           # sidecar: verdicts, episodes, counters
            ├── attempts/            # slim per-attempt records (digest substrate)
            │   └── <task-id>-<ordinal>.json
            ├── reviews/             # Reviewer documents, latest by timestamp
            │   └── <ISO-timestamp>.md
            └── drain.lock           # present only while a drain is live
```

`<set-id>` is a lowercase kebab-case slug, unique under `.cook/tasks/`, and
is the set's identity everywhere (commands, commit trailers, gates).

## manifest.json

```json
{
  "id": "feature-x",
  "priority": 0,
  "tasks": [
    {
      "id": "01-first-task",
      "file": "01-first-task.md",
      "type": "afk",
      "status": "open",
      "blocked_by": [],
      "commit_subject": "feat(feature-x): add the widget scaffold",
      "attempts": 0,
      "human_completed": false
    }
  ]
}
```

Set-level fields:

- `id` (string, required) — MUST equal the directory name.
- `priority` (integer, default 0) — selection order for no-argument
  `/cook`: higher first, ties broken by set-id ascending.

Per-task fields:

- `id` (string, required) — unique within the set. By convention the file
  stem.
- `file` (string, required) — the task's markdown file, relative to the
  set directory.
- `type` (`"afk"` | `"hitl"`, required) — see the typing rules below.
- `status` (`"open"` | `"done"` | `"failed"` | `"skipped"`, required).
- `blocked_by` (array of task ids, default `[]`) — prerequisites. A
  prerequisite counts as satisfied when it is `done` **or** `skipped`.
- `commit_subject` (string, optional) — the planned commit subject, used
  verbatim by the implementation commit when present.
- `attempts` (integer, default 0) — started attempts charged to this task
  in the current line of attack; reset to 0 when a human reopens the task.
- `human_completed` (boolean, default false) — set when a human, not the
  executor, marked the task done. A human completion outranks the Verifier's
  verdict in status derivation.

Fields written by the executor on task completion (absent until then):

- `commit_sha`, `commit_subject_used` — the implementation commit, when one
  was made (a clean-tree completion is a No-Op and records neither).

Unknown manifest keys are **warnings, not errors** — a newer cook may write
keys an older one ignores.

## Task file (`<task>.md`)

```markdown
# <Task title>

## Parent
<optional: references to context this task depends on — the spec, an ADR,
another task's output. The task may also be self-contained.>

## What to build
<the work, described so a fresh-context agent can do it without asking>

## Acceptance criteria
- [ ] <criterion one>
- [ ] <criterion two>
```

The checkboxes are **load-bearing**: the attempt contract requires the
implementer to tick every satisfied box (`- [ ]` → `- [x]`), and an attempt
that leaves a box unticked is recorded as failed even when the work itself
landed. Every AFK task MUST have at least one checkbox. The task file is
the one file the implementer edits besides the code.

### HITL typing rules

- A HITL task contains **only human work** — verification, decisions,
  manual checks, sign-off.
- Agent-doable prep (building the artifact the human verifies) belongs in a
  separate AFK task that the HITL task is `blocked_by`.
- A HITL task describing software to build is mis-typed.
- The canonical shape is a single terminal HITL sign-off task, blocked by
  every AFK task in the set.

## progress.txt

Append-only. One block per terminal transition:

```
<RFC3339 UTC timestamp> [<task-file>] <OUTCOME>
<summary — one or more lines>
---
```

Outcome markers, ported from pop verbatim:

- `DONE` — the executor completed the task (summary = the agent's SUMMARY
  block).
- `FAILED` — the task went failed (summary = the failure reason).
- `COMPLETE` — a human marked the task done by hand.
- `RESET` — a human reopened the task; everything before this marker
  belongs to an abandoned line of attack (the retry digest cuts here).
- `SKIP` — a human skipped the task.

Set-level events use the literal task-file `set`.

## spec.md (optional)

The planning spec co-located with the set. It is handed to the Verifier and
Reviewer as **context only** — the acceptance criteria in the task files
remain authoritative, always.

## state.json

The sidecar replacing what pop keeps in its database. Cook-owned; nothing
else writes it.

```json
{
  "set_base_commit": "<sha or null>",
  "verdict_cache": {
    "verdict": "PASS | FIXABLE | NEEDS-HUMAN | HUMAN-PASS",
    "work_sha": "<sha judged>",
    "summary": "<one line, optional>",
    "findings": "<text, empty for PASS>",
    "at": "<RFC3339>"
  },
  "last_pass": { "work_sha": "<sha>", "at": "<RFC3339>" },
  "verification_episode_fingerprint": "<hash>",
  "review_episode_fingerprint": "<hash>",
  "remediation_depth_used": 0,
  "human_note": "<optional: the note a human recorded when accepting past a finding>"
}
```

- `set_base_commit` — the parent of the set's **first** implementation
  commit; the Verifier/Reviewer commit range is
  `<set_base_commit>..HEAD`. Null until the first commit.
- `verdict_cache` — the current verdict at its judged SHA. `HUMAN-PASS` is
  a human-authored acceptance recorded at the Verify-failed gate.
- `last_pass` — the latest PASS in the current episode; it immunizes the
  terminal status against later commits.
- `verification_episode_fingerprint` — a hash of the sorted ids of the
  currently-`done` AFK tasks. When the recomputed fingerprint differs from
  the stored one, the episode has ended: the verdict cache and `last_pass`
  are cleared and fresh verification is required. HITL-only transitions
  never change the fingerprint.
- `review_episode_fingerprint` — the same construction for the Reviewer: a
  matching fingerprint means the current review document still describes
  this work and no re-review runs.
- `remediation_depth_used` — Remediation tasks spawned in this episode;
  compared against the config cap.

Per-task attempt counters live in the manifest (`attempts`), not here, so
one manifest write carries both a status transition and its bookkeeping.

## attempts/

One small JSON file per started attempt, written whatever the outcome:

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

Filename: `<task-id>-<ordinal>.json`. These records exist **solely as the
retry digest's substrate** (see `05-retry.md`). They are not telemetry, not
an audit trail, and carry no raw transcript. Records from before the task's
latest `RESET` journal marker are out of digest scope.

## .cook/config.json

```json
{
  "max_tries": 3,
  "retry_delays": [],
  "verify": true,
  "review": true,
  "remediation_depth": 2,
  "commit_overrides": []
}
```

- `max_tries` (default 3) — started attempts per task before it goes
  failed.
- `retry_delays` (default `[]`, meaning **off**) — inter-attempt waits as
  duration strings (`"1m"`); once exhausted the last entry repeats. Off by
  default in cook (a marked divergence from pop, whose default is
  `["1m","5m","15m"]`): sleeping inside an attended agent session buys
  little.
- `verify` (default **true**) — run the Verifier automatically at the
  drain's tail. A marked divergence: pop defaults verification off.
- `review` (default **true**) — run the Reviewer automatically after a
  PASS. Likewise on by default where pop's is off.
- `remediation_depth` (default 2) — Remediation tasks per verification
  episode before the set parks at VERIFY-FAILED. The default is cook's own
  choice; pop leaves it to configuration.
- `commit_overrides` (default `[]`) — extra `git -c` config pairs applied
  to implementation commits (e.g. disabling commit signing).

Missing file or missing keys mean the defaults. Per-invocation arguments
override config.

## Validation rules (register)

`/cook:plan` self-validates with these same rules; `/cook:register` applies
them to hand-authored or hand-edited sets. Faults are **errors** (the set
is MALFORMED and will not drain) unless marked as warnings:

1. `manifest.json` parses, and `id` equals the directory name.
2. Every manifest task entry names a readable file in the set directory.
3. Task ids are unique; every `blocked_by` reference resolves to an
   existing task id; no dependency cycles.
4. Every AFK task's file has at least one checkbox under an
   `## Acceptance criteria` heading.
5. No orphan `.md` files: every `.md` in the set directory except
   `spec.md` has a manifest entry.
6. `type` and `status` hold only their allowed values.
7. Unknown manifest keys — warning only.
8. HITL tasks SHOULD be terminal or block AFK work deliberately; a HITL
   task whose body describes software to build — warning naming the typing
   rule.

<!-- format-contract-end -->

## Sources in pop

- `CONTEXT.md` — glossary entries: **Task manifest**, **Manifest vs
  progress record vs captured stream (State vs Journal vs Telemetry)**
  (`CONTEXT.md:1714`), **Authoring guide**, **Task retry cap**, **Task
  attempt retry schedule**, **Verify verdict**, **verification episode**
- `tasks/progress.go` — the journal block format and markers
- `tasks/attempts.go:496-566` — ImplementationCommit, set base commit
- `tasks/authoring_guide.go`, `validateManifest` (`tasks/`) — the
  validation and HITL typing rules (pop ADR-0183)
- pop ADR-0207 (planned commit subjects, set base commit), ADR-0179
  (human completion), ADR-0190 (turn cap outcome names)
- Cook divergences recorded here: verify/review defaults on,
  retry_delays default off, remediation_depth default 2, `state.json`
  replacing pop.db. See `PARITY.md`.
