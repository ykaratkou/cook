# The verify phase

An independent Verifier judges the set's completed AFK work against its
acceptance criteria. Verification is **on by default** (`verify: true`).

## When the automatic run fires

In the drain loop's verify phase, whenever the set enters the **terminal
zone** — manifest-derived DONE, or AWAITING-APPROVAL (no open AFK work, only
HITL sign-off left) — and `verify` is true:

1. Recompute the **episode fingerprint**: the sorted ids of the
   currently-`done` AFK tasks joined with `,`, stored verbatim. This
   identity encoding is the "hash" the spec requires — it is deterministic,
   so every session (including a re-entered drain) computes the same value
   for the same composition. Never substitute a different encoding.
2. If it differs from `state.json`'s stored
   `verification_episode_fingerprint`, the episode has ended: clear
   `verdict_cache` and `last_pass`, store the new fingerprint — fresh
   verification is required.
3. If the current episode has a `last_pass` — **PASS immunizes the episode**:
   spawn nothing; the verify phase is a cache lookup. HEAD drifting past the
   verified SHA does not re-verify.
4. If the current episode has a cached non-PASS verdict, apply its
   disposition (below) without a fresh spawn — except NEEDS-HUMAN, which
   warrants a fresh automatic verify on the next terminal arrival after its
   gate was left.
5. Otherwise spawn the Verifier.

On an AWAITING-APPROVAL set this runs **before** the HITL sign-off gate
opens: cheap agent checking precedes expensive human time. A PASS opens the
gate.

## Force mode (`/cook:verify <set-id>`)

Always spawn a fresh Verifier, regardless of any cached verdict. Force is the
human's escape hatch; the cache governs only automatic runs. Record and
report the verdict exactly as below.

## Assembling the prompt

Render `prompts/verifier.md` (rules in the drain SKILL.md) from:

- The set id and the current work SHA (`HEAD`).
- The **done AFK task bodies with their acceptance criteria — and only
  those**. Open AFK tasks and HITL tasks (any status) are deliberately
  omitted: a not-yet-run HITL sign-off is not an unmet criterion.
- The commit range `<set_base_commit>..HEAD` and a **complete**
  `git diff --stat` for it. Diff **bodies are never inlined** — the subagent
  runs in the checkout and fetches what it decides to judge.
- The optional co-located `spec.md`, marked context-only.
- The **prior human note** from `state.json`, when one exists.
- The **remediation history**, when remediation tasks have already run in
  this set (which tasks, their findings), so the Verifier knows what was
  already tried.

The `{{#if convention_recorded}}` sections never render (cook v1 configures
no commit convention); a `COMMIT-SUBJECT:` line in the reply is ignored.

## Parsing the verdict

```
VERDICT: PASS | FIXABLE | NEEDS-HUMAN        (first line, required)
SUMMARY: <one line>                           (optional; omitted on PASS)
FINDINGS: <what fails a criterion and why>    (empty on PASS)
```

A reply whose first line parses to none of the three verdicts is a **failed
Verifier attempt** — retry the spawn under the same `max_tries` cap as
implement attempts.

## Dispositions

- **PASS** — write to `state.json`: `verdict_cache` (verdict, `work_sha`
  judged, `at`), `last_pass` (`work_sha`, `at`), and the episode fingerprint.
  Continue the loop (terminal handling / review phase follow).
- **FIXABLE** —
  1. Spawn a **Remediation task**: a new AFK task file whose body carries the
     findings **verbatim** (findings live only there — never as annotations
     in another task's file), origin `auto`, appended to the manifest with at
     least one acceptance checkbox derived from the findings. Follow the
     format contract (register skill).
  2. Wire the new task into every open HITL task's `blocked_by`, so sign-off
     waits on the fix.
  3. **Invalidate**: hard-delete `verdict_cache` and `last_pass` from
     `state.json` (the episode is about to change). The journal is not
     touched — it is history, not cache.
  4. Increment `remediation_depth_used`; continue the loop — the remediation
     task is eligible AFK work and drains like any other. Re-verification
     afterward is mandatory (the fingerprint changed).
  Bounded by `remediation_depth` (default **2**) per verification episode:
  when the cap is already used up, do not spawn — park the set at the
  **Verify-failed gate** (`gates.md`), recording the non-PASS verdict.
- **NEEDS-HUMAN** — record the verdict in `verdict_cache`, park at the
  **Verify-failed gate** immediately. This verdict warrants a fresh automatic
  verify on the next terminal arrival.

### Human completion suspends non-PASS dispositions

When the terminal state was reached through a task carrying
`human_completed`, every non-PASS disposition is suspended: the verdict still
runs, is recorded, and is printed, but it neither parks the set nor spawns
remediation — spawning fix work would reopen work the human deliberately
closed. The finding lands only as a verification mark beside the status.

## Episodes — when a cached verdict dies

A verification episode is one contiguous stretch during which the set's
done-AFK composition is unchanged (the fingerprint above).

- Any AFK task moving **into open** (reopen) or **into done** (new
  completion, remediation tasks included) changes the fingerprint → every
  cached verdict is invalid → the next terminal arrival requires fresh
  verification.
- **HITL-only transitions never invalidate** — complete, skip, or reopen of a
  HITL task leaves the fingerprint untouched.
- Invalidation is a hard delete of the cached verdicts in `state.json`.

`HUMAN-PASS` (recorded at the Verify-failed gate's *accept* outcome) is
cached like an agent PASS: episode immunity applies.

## Sources

`docs/spec/06-verify.md` in the cook repository (pop sources in its footer).
