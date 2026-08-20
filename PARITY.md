# Parity ledger

Cook is a continuous port of pop's task-set implement feature. This ledger is
the porting instrument: it records how far the port has caught up with pop,
which pop subsystems are deliberately in or out, where cook knowingly
diverges, and which pop sources each cook document is written from. Cook takes
pop's *design* only — there is no runtime dependency on pop and no
interoperability goal.

## How a porting session works

1. In pop, list what changed since the watermark:
   `git log <watermark>..master --oneline`.
2. For each commit, check the doc-to-source map below: a commit touching a
   listed pop source means the mapped cook doc(s) may need an edit; a commit
   touching nothing listed is out of scope by construction (or a scope gap —
   add the source to the map).
3. Apply the edits, run the drift-guard checklist, advance the watermark.

The ledger is designed so this can later be automated: a scheduled agent that
diffs pop against the watermark, resolves the map, and proposes edits. Nothing
here assumes a human is the one doing step 2.

## Watermark

**Ported up to pop commit `ee676f0` (2026-08-20).**

## Scope: IN

| Subsystem | Cook doc |
| --- | --- |
| Storage contract (manifest, task files, journal, sidecar state) | `docs/spec/01-storage.md` |
| Status derivation and task eligibility | `docs/spec/02-status-derivation.md` |
| Drain loop and Implement run | `docs/spec/03-drain.md` |
| Attempt contract, assessment, commit machinery | `docs/spec/04-attempt.md` |
| Retry loop, lessons table, carry-forward digest | `docs/spec/05-retry.md` |
| Verifier, verdicts, episodes, remediation loop | `docs/spec/06-verify.md` |
| Reviewer and review episodes | `docs/spec/07-review.md` |
| The four gates (HITL, Failed, Verify-failed, Interrupt) | `docs/spec/08-gates.md` |
| Every agent prompt, verbatim with marked edits | `docs/spec/09-prompts.md` |
| Host capability matrix | `docs/spec/10-hosts.md` |

## Scope: OUT

Each exclusion is a decision, not an omission. One line each:

| Pop subsystem | Why out |
| --- | --- |
| Agent fallback across presets + quota cooldown store | In-agent, the host is the only agent; there is no preset list to fall through. |
| Worktree bindings, fold, trunk management, drain routing | Pop-specific checkout infrastructure; cook drains the current checkout. |
| Work daemon / supervision | There is no process to be a daemon in; cook v1 is attended-only. |
| Dashboard / TUI surfaces | The host session is the surface; cook prints, it does not render. |
| Captured-run telemetry + spend lens | Telemetry infrastructure; only the 10% the digest needs survives, as Attempt records. |
| Prompt spill to file | An argv-size workaround; in-agent prompts never ride argv. |
| Attended assistance sessions | The human is already in an agent session; gates ask in-session instead. |
| Routines | A different pop feature, not the implement loop. |

## Marked divergences

Places where cook knowingly departs from pop. Every divergence is deliberate
and carries its reason; anything not listed here is intended to match pop.

| Divergence | Pop | Cook | Why |
| --- | --- | --- | --- |
| Verify default | Off | **On** | Verification is half the reason to want the feature; user decision at grill Q21; ADR-0005. |
| Review default | Off (opt-in verb) | **On** | Same grill decision (ADR-0005); the Reviewer still gates nothing. |
| Retry delays | `1m, 5m, 15m` | **Default-off** (key kept) | Sleeping inside an agent session buys little; ADR-0004. |
| Verifier/Reviewer independence | Separate process, possibly different vendor | Fresh-context subagent, same model | The strongest independence both hosts can offer; ADR-0003. |
| Cap enforcement | Supervisor-enforced (SIGKILL, `time.After`) | Orchestrator-checked before the next spawn; Turn cap and timeout-kill declared Blind | Instructions cannot kill mid-flight; ADR-0004. |
| Unattended operation | Work daemon spawns drains | Attended-only v1; gate semantics for a future headless mode spec'd dormant | ADR-0004. |
| Storage formats | pop's files + pop.db | Cook-owned files only, **no pop interop** | No runtime dependency on pop; ADR-0002. |
| Dirty-checkout strategies | continue / commit-and-continue / stash-and-continue | `continue` only | v1 cut; the other two are ledgered, not lost. |

## Doc-to-source map

Every cook doc carries its own "Sources in pop" footer; this table is the
union, for the porting diff.

| Cook doc | Pop sources |
| --- | --- |
| `CONTEXT.md` | pop `CONTEXT.md` (glossary), ADR-0190, ADR-0207, ADR-0216 |
| `docs/spec/00-overview.md` | pop `CONTEXT.md` (Implement run, Drain, Turn cap), ADR-0190 |
| `docs/spec/01-storage.md` | pop `CONTEXT.md` (Task manifest, State vs Journal vs Telemetry), `tasks/authoring_guide.go` |
| `docs/spec/02-status-derivation.md` | pop `CONTEXT.md` (status derivation, eligibility), `tasks/verified_status.go` |
| `docs/spec/03-drain.md` | pop `CONTEXT.md` (Implement, Drain), `tasks/run_tasks.go`, `tasks/executor.go` |
| `docs/spec/04-attempt.md` | `tasks/attempts.go`, `tasks/prompts/agent.tmpl.md`, ADR-0207, ADR-0216 |
| `docs/spec/05-retry.md` | `tasks/digest.go`, pop ADR-0040, ADR-0190 (turn-cap lesson) |
| `docs/spec/06-verify.md` | `tasks/verify.go`, `tasks/verify_phase.go`, `tasks/prompts/verifier.tmpl.md`, ADR-0096, ADR-0109, ADR-0179 |
| `docs/spec/07-review.md` | `tasks/review.go`, `tasks/review_phase.go`, `tasks/review_episode.go`, `tasks/prompts/reviewer.tmpl.md`, ADR-0214 |
| `docs/spec/08-gates.md` | `tasks/gates.go`, `tasks/interrupt_gate.go`, `tasks/prompts/*-assistance.tmpl.md` |
| `docs/spec/09-prompts.md` | `tasks/prompts/*.tmpl.md` (all), `tasks/digest.go` (lesson strings) |
| `docs/spec/10-hosts.md` | pop's adapter-capability pattern (ADR-0165, ADR-0166, ADR-0190) |
| `PARITY.md` | the whole of the above |

## Drift-guard checklist

Run at the end of every porting session:

- [ ] The storage-format text inside the plan and register skills is a
      **verbatim copy** of the contract section of `docs/spec/01-storage.md`.
      The copy is shared: it lives at
      `skills/register/references/format-contract.md` (below its header, in
      the root `skills/` directory both hosts symlink), and the plan skill
      reads that same file.
      (Pop generates its authoring guide from validator constants; cook cannot
      generate, so this manual check is the honest substitute. If drift ever
      bites, a generator script is the v2 answer.)
- [ ] Every prompt in the shipped `prompts/` directory still matches
      `docs/spec/09-prompts.md`, cook-marked edits included (the `[COOK: …]`
      markers stay in the shipped source; rendering strips them).
- [ ] Every divergence discovered while porting is either resolved or added
      to the marked-divergences table.
- [ ] The watermark is advanced.

## Sources in pop

- The repository at `../pop`, watermark `ee676f0`.
- pop `CLAUDE.md` / `docs/agents/navigation.md` — the package map the
  doc-to-source table's paths come from.
- pop ADRs cited per-row above: 0040, 0096, 0109, 0165, 0166, 0179, 0190,
  0207, 0214, 0216.
