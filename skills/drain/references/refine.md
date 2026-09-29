# The refine phase

An independent **Refiner** holds everything the set changed to the
repository's **Implementation convention**, fixes in place what is
reversible, and writes a **Refine report**; you commit its fixes as one
**Refine commit**. It answers how well the code is written — the Verifier,
which runs **after** it, answers whether it works. **Non-gating**: no outcome
of this phase parks the set, spawns a task, or changes its terminal status.
Refine is **on by default** (`refine: true`); turning it off removes the
automatic run only.

## When the automatic run fires

First in each Drain turn's phase steps — **before** the verify phase — when
all of these hold:

1. `refine` is true;
2. the manifest-derived status is DONE or AWAITING-APPROVAL (the terminal
   zone);
3. the terminal state was not reached through a task carrying
   `human_completed` — the drain never edits code a human declared done;
4. the **Refine episode is armed**: recompute the fingerprint — the sorted
   ids of the currently-`done` AFK tasks **without an `origin` field** (i.e.
   not Remediation tasks), joined with `,`, stored literally, compared by
   string equality. Armed when it is non-empty and differs from `state.json`'s
   `refine_episode_fingerprint` (or none is stored). Not armed → skip; this
   composition has been refined;
5. the preconditions below hold.

A skipped precondition, a spawn error, or a reply you cannot turn into a
report: print one line — `Refine did not run for <set-id>: <why>` — and fall
through. The episode stays armed. The **only** thing that ends the drain here
is the human's interrupt: exit, report it (no gate opens), and tell the human
the Refiner's partial edits are uncommitted in the working tree.

## Force mode (`/cook:refine <set-id>`)

A full pass on any set with refinable work — mid-drain, VERIFY-FAILED,
human-completed or DONE alike — ignoring `refine`, the human-completion skip,
and the episode. Take `drain.lock` first (refuse on a fresh lock, exactly as a
drain start does — SKILL.md) and remove it on every exit path. Report the
Refine pointer and the commit made (if any), never the report body.

## Preconditions

- **Refinable work**: at least one done AFK task, and a known, non-empty
  commit range `<set_base_commit>..HEAD`.
- **Clean tree outside `.cook/`**: `git status --porcelain -- .
  ':(exclude).cook'` is empty. (The abandon restore below is scoped to
  exclude `.cook/`; starting clean is what makes it exact.) The forced verb
  refuses on dirt and shows `git status`.

## One pass, in order

1. **Mark the start**: one `state.json` write setting `refine_last` to
   `{ "outcome": "started", "work_sha": "<HEAD>", "at": "<RFC3339 UTC now>" }`.
2. **Spawn the Refiner** — a fresh-context subagent, spawned and its output
   captured per your host's delivery note (host-claude-code.md) — with
   `prompts/refiner.md` rendered (rules in the drain SKILL.md) from:
   - `task_set`; `work_range` = `<set_base_commit>..HEAD`; `work_stat` = the
     **complete** `git diff --stat` for it (bodies never inlined);
   - `tasks`: every task's id and title;
   - `spec`: the optional `spec.md`;
   - `previous`: the latest Refine report's full text, when one exists (by
     timestamp under `refine/`);
   - `convention`: the resolved **implementation** convention — the target
     repository's `docs/agents/implementation.md` when present and
     non-empty, else `${CLAUDE_PLUGIN_ROOT}/conventions/implementation.md`.
     Always renders;
   - `overlay`: `docs/agents/refine.overlay.md` when present with a
     non-blank body; otherwise the section drops;
   - `verification_convention_path`: the resolved **verification**
     convention's path — `docs/agents/verification.md` when present and
     non-empty, else `${CLAUDE_PLUGIN_ROOT}/conventions/verification.md`;
   - `commit_convention_recorded` never holds (dormant).
3. **Parse the reply.** Look only at the lines **before its first Markdown
   heading** (a line starting `#`):
   - a `REFINE-OUTCOME:` line (tolerate `**` decoration and `REFINE OUTCOME`
     / `REFINE_OUTCOME`; the colon is required) whose value is `refined`,
     `gate-blocked`, or `abandoned` → that outcome; lift the line out of the
     body. Missing or unrecognized → **`refined`**;
   - a `COMMIT-SUBJECT:` line → lift it and ignore it (dormant).
   The rest, trimmed, is the report body.
4. **Write the Refine report** — before any git action — as a file you
   create whole through the cook-state read and mutation capability, at
   `.cook/tasks/<set-id>/refine/<ISO-8601-timestamp>.md` (timestamp from the
   RFC3339 UTC timestamps capability; advance a second if the name is
   taken):

   ```markdown
   # Refine report — <set-id>

   - Refined: <RFC3339 UTC>
   - Commit range: <set_base_commit>..<HEAD short sha>
   - Work SHA: <HEAD short sha, read before the spawn>
   - Refiner: claude-code

   <report body>
   ```
5. **Act on the outcome:**
   - `gate-blocked` — do nothing to the tree; commit nothing.
   - `abandoned` — discard the pass's edits, never touching `.cook/`:
     `git restore --source=HEAD --staged --worktree -- . ':(exclude).cook'`
     then `git clean -fd -- . ':(exclude).cook'`. Commit nothing.
   - `refined` — if `git status --porcelain -- . ':(exclude).cook'` is
     non-empty, make the **Refine commit**: `git add -A`, unstage the set's
     `drain.lock` when present, then
     `git [-c <commit_overrides>…] commit -m "cook(<set-id>): refine" -m "Cook-Refine: <set-id>"`
     (the trailer in its own `-m` paragraph). Nothing changed outside
     `.cook/` → commit nothing.
6. **Record**: one `state.json` write setting `refine_last.outcome` to the
   parsed outcome and — **only on `refined`** — `refine_episode_fingerprint`
   to the fingerprint from step 4 of "When the automatic run fires"
   (recompute it the same way in force mode).

## The Refine mark

Derive it (read-only) only when `refine` is true and the set is in the
terminal zone, from `refine_last`:

| `refine_last.outcome` | Show |
|---|---|
| absent | Not refined |
| `started` (the pass never finished) | Not refined |
| `refined` | Refined |
| `gate-blocked` | Not refined: the scoped gate was already red when the pass began |
| `abandoned` | Not refined |

It gates nothing. Show it at the HITL sign-off gate, in `/cook:status`, and
in the exit report.

## The Refine pointer

Surfaces never inline the report body — they carry:

- the latest report's path,
- the commit it describes — the header's `Work SHA` (and `Commit range`),
- an **out-of-date** flag when HEAD's short SHA no longer matches that Work
  SHA ("parts of it may describe files as they no longer are; check what
  changed since before acting on a finding").

It fills the `latest-refine-report` partial in every gate prompt and is shown
in `/cook:status` detail and the exit report.

## Sources

`docs/spec/07-refine.md` in the cook repository (pop sources in its footer).
