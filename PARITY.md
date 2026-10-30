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

**Ported up to pop commit `af9826ef` (2026-10-21)**, except the features listed
under *Deferred* below, which were left at their pop state on purpose.

Previous watermarks: `17648e6` (2026-09-27), `ee676f0` (2026-08-20).

## Scope: IN

| Subsystem | Cook doc |
| --- | --- |
| Storage contract (manifest, task files, journal, sidecar state) | `docs/spec/01-storage.md` |
| Status derivation and task eligibility | `docs/spec/02-status-derivation.md` |
| Drain loop and Implement run | `docs/spec/03-drain.md` |
| Attempt contract, assessment, commit machinery | `docs/spec/04-attempt.md` |
| Retry loop, lessons table, carry-forward digest | `docs/spec/05-retry.md` |
| Verifier, verdicts, episodes, remediation loop | `docs/spec/06-verify.md` |
| Refine: Refiner, Refine commit and report, episode, mark, conventions | `docs/spec/07-refine.md` |
| The four gates (HITL, Failed, Verify-failed, Interrupt) | `docs/spec/08-gates.md` |
| Every agent prompt and shipped convention, verbatim with marked edits | `docs/spec/09-prompts.md` |
| Host capability matrix | `docs/spec/10-hosts.md` |

## Scope: OUT

Each exclusion is a decision, not an omission. One line each:

| Pop subsystem | Why out |
| --- | --- |
| Agent fallback across presets + quota cooldown store | In-agent, the host is the only agent; there is no preset list to fall through. |
| Worktree bindings, fold, trunk management, drain routing | Pop-specific checkout infrastructure; cook drains the current checkout. |
| Work daemon / supervision | There is no process to be a daemon in; cook v1 is attended-only. |
| Dashboard / TUI surfaces | Pop's dashboard was a *place you went* to look at runs, with its own lifecycle and navigation; cook has no such place and ships no view you can open. Each host's own views of cook's work (Claude Code's subagent panel and `/tasks`, opencode's child sessions) are that host's, not cook's (ADR-0009's Human-facing rows). |
| Captured-run telemetry + spend lens | Telemetry infrastructure; only the 10% the digest needs survives, as Attempt records. |
| Prompt spill to file | An argv-size workaround; in-agent prompts never ride argv. |
| Attended assistance sessions | The human is already in an agent session; gates ask in-session instead. |
| Routines | A different pop feature, not the implement loop. |
| Convention stack's per-user ranks (`~/.agents/docs/…`, Project and Global conventions, the per-user Overlay), `pop conventions` verbs, Convention assist | Machine-wide preferences for one human; cook ports only the repository rank and its shipped answer (ADR-0013). |
| Cache database, Manifest memo, Derivation stamp (pop ADR-0243, ADR-0265) | Cook caches no derived answer: every surface re-derives from files, so nothing can outlive the rules that produced it. The stamp covers pop's manifest-*validation* cache, not Verify verdicts. |
| Work journal (severity, spent retry caps, Drain endings, `pop work log`) | pop.db telemetry. Cook's only journal is `progress.txt`. |
| Per-phase agent choice and Verify offered at every gate (pop ADR-0264/0266/0269) | Part of attended assistance and agent fallback; cook has one agent, and its Verify-failed gate keeps pop's glossary rule that re-verify is not offered there. |
| Objective gates (pop ADR-0277) | In pop's docs only, not its code, at the watermark. Needs its own IN/OUT decision once pop ships it. |

## Deferred

Pop features past a previous watermark that cook has decided **not to port
yet** (user decisions, 2026-09-29 and 2026-10-30). They are not OUT: each one ports as a unit
in a later session, and the pop sources below are where that session starts.
The watermark does not cover them.

| Pop feature | Pop sources | What cook would need |
| --- | --- | --- |
| Exploration report: `explore: true`, the Explore phase, EXPLORE-FAILED, the Exploration mark, `pop tasks explore` | ADR-0262; `tasks/explore*.go`, `tasks/exploration_pointer.go`, `tasks/prompts/explorer.tmpl.md`, the exploration arm of `agent.tmpl.md` and `assist.tmpl.md` | A new spec doc; `exploration.md` in the set directory, unstaged from commits; the fact that a pass gave up recorded in `state.json`; a read-only subagent posture (plugin agent definition); `/cook:explore`. |
| Planning sources and Intent drift | ADR-0276; `tasks/verify_planning_sources.go`, `tasks/implement_planning_sources.go`, the planning-sources sections of `verifier.tmpl.md` / `agent.tmpl.md`, `conventions/shipped/planning-sources.md` | Manifest `planning_sources` (set) and per-task claims plus validation; Verifier section with fixed cook text in place of the convention; plan skill records the source ticket. |
| AFK standstill trigger: Refine and verify also at a mid-ladder BLOCKED HITL gate | ADR-0258; pop `GLOSSARY.md` **AFK standstill** (decided in pop, *not yet coded* at the watermark: `refine_phase.go` / `verify_phase.go` still fire only at the terminal zone) | A standstill predicate beside the terminal zone in doc 02; doc 06/07 triggers; remediation wired into the mid-ladder gate. Port once pop codes it. |
| Writing convention, and a commit body written apart from the run summary (deferred 2026-10-30) | ADR-0286, ADR-0287; `conventions/shipped/writing.md`, `conventions/kind.go`, `tasks/writing_convention.go`, `tasks/assess.go` (`COMMIT_BODY` block), `tasks/attempts.go` / `tasks/refine_commit.go` (body sanitising), the writing blocks of `agent.tmpl.md`, `refiner.tmpl.md`, `verifier.tmpl.md`, `partials.tmpl.md` (`writing-convention`) and every gate prompt | `conventions/writing.md` plus its stack in doc 07; the writing section in every prompt, and pop's generic prose lines ("No preamble, no sign-off") deleted from them; doc 04 stops using SUMMARY as the commit body. The `COMMIT_BODY` block only renders with a recorded commit convention, which cook v1 lacks, so cook would need its own body rule or convention support first. |
| Checkout-wide admission: tree-stable operations hold the checkout, and a human command waits instead of refusing | ADR-0238, ADR-0239, ADR-0240; `tasks/admission.go`, `tasks/tree_stable.go`, `tasks/checkout_claim.go` | A checkout-wide lock that drains and forced verbs take; cook has had no lock since ADR-0015. Waiting instead of refusing would be a marked divergence (no sleep loops in-session, ADR-0004). |

## Marked divergences

Places where cook knowingly departs from pop. Every divergence is deliberate
and carries its reason; anything not listed here is intended to match pop.

| Divergence | Pop | Cook | Why |
| --- | --- | --- | --- |
| Verify default | Off | **On** | Verification is half the reason to want the feature; user decision at grill Q21; ADR-0005. |
| Refine default | Off (`[work.refine].enabled`) | **On** (`refine: true`) | Same grill decision as verify (ADR-0005), carried over when Refine replaced the Reviewer (ADR-0013). Safe because Refine runs before verify, which is also on, so every Refine commit is judged. |
| Refine restore | Snapshot any dirt (`git stash create`), then `reset --hard` + `clean -fd` + `stash apply` | Needs a **clean tree outside `.cook/`**; restores and change-checks with a `':(exclude).cook'` pathspec; the Refiner is told to leave `.cook/` alone | Cook's task storage lives inside the checkout, and a whole-tree restore would destroy the report and state the pass had just written (ADR-0013). |
| Refine mark source | The latest Captured run of phase `refine` | `refine_last` in `state.json` (`started` → the parsed outcome) | Captured runs are OUT (ADR-0013). |
| Remediation identity | Id pattern `^\d+-remediation$` | Manifest field `origin: auto \| human` | Explicit beats a naming convention a human might break; cook's docs already spoke of origin (ADR-0013). |
| Convention stack | Four answering ranks + per-user and repository Overlays | Repository rank + shipped rank + repository Overlay | Per-user ranks are OUT (above). |
| Shipped convention files | Embedded in the binary | `conventions/*.md` at the plugin root, **unmarked**; their edits recorded in doc 09 §11 | Agents read them straight from disk (the Refiner opens the verification convention by path), so `[COOK: …]` markers would reach the agent. |
| Concurrency guard | Database-backed Runtime execution lock; checkout admission (`AcquireTreeStable`) for the forced verbs | **None**: one drain per set at a time, and no `/cook:verify` or `/cook:refine` beside it, is the human's discipline | The lock's per-turn refresh, exit-path cleanup, stale-lock window, commit unstaging, and per-host session plumbing cost more than the mistake it guarded; admission stays deferred (above); ADR-0015. |
| Retry delays | `1m, 5m, 15m` | **Default-off** (key kept) | Sleeping inside an agent session buys little; ADR-0004. |
| Verifier/Refiner independence | Separate process, possibly different vendor | Fresh-context subagent, same model | The strongest independence either host can offer; ADR-0003. |
| Cap enforcement | Supervisor-enforced (SIGKILL, `time.After`) | Orchestrator-checked before the next spawn; Turn cap and timeout-kill declared Blind | Instructions cannot kill mid-flight; ADR-0004. |
| Unattended operation | Work daemon spawns drains | Attended-only v1; gate semantics for a future headless mode spec'd dormant | ADR-0004. |
| Storage formats | pop's files + pop.db | Cook-owned files only, **no pop interop** | No runtime dependency on pop; ADR-0002. |
| State write atomicity | Atomic: write a temp file in the same directory, then rename over the target (Go) | **Non-atomic**: one in-place write through the host's cook-state read-and-mutation capability, no rename | Neither in-agent host exposes a rename primitive, so the rule could only be obeyed by authoring a program; the single-writer discipline (one drain per set, kept by the human; ADR-0015) makes the torn-write window the lesser risk against orchestrators improvising state rewrites; ADR-0008. |
| Adapter capability declaration | Supported / Blind | Supported / Blind / **Human-facing** | Cook's matrix also lists host affordances no cook logic reads (subagent trace visibility; loop hardening until ADR-0015 dropped it); declaring those Supported would spend the one distinction the matrix exists to make. Human-facing names the audience instead; ADR-0009. |
| Companion planning skills | Pop's planning path is pop's own code; cook reuses only its issue-tracker adapter-doc mechanism (`integrate/issue-tracker.md`) | **Third-party skills vendored verbatim** — `grill-with-docs`, `grilling`, `domain-modeling`, `to-spec`, `to-tickets` (MIT) ship under `skills/` | `/cook:plan` is composed from an existing skill set instead of reimplemented, so the entry verb works on a bare install; ADR-0010. |
| Dirty-checkout strategies | continue / commit-and-continue / stash-and-continue | `continue` only | v1 cut; the other two are ledgered, not lost. |

## Doc-to-source map

Every cook doc carries its own "Sources in pop" footer; this table is the
union, for the porting diff.

| Cook doc | Pop sources |
| --- | --- |
| `CONTEXT.md` | pop `GLOSSARY.md` (glossary), ADR-0190, ADR-0211, ADR-0216, ADR-0231, ADR-0245, ADR-0246/0247/0248/0252/0260, ADR-0259, ADR-0267 |
| `docs/spec/00-overview.md` | pop `GLOSSARY.md` (Implement run, Drain, Turn cap), ADR-0190 |
| `docs/spec/01-storage.md` | pop `GLOSSARY.md` (Task manifest, State vs Journal vs Telemetry), `tasks/authoring_guide.go` (incl. Orientation), `tasks/manifest.go` (validation), ADR-0267 |
| `docs/spec/02-status-derivation.md` | pop `GLOSSARY.md` (status derivation, eligibility), `tasks/verified_status.go`, `tasks/refine_mark.go` |
| `docs/spec/03-drain.md` | pop `GLOSSARY.md` (Implement, Drain, Drain turn), `tasks/run_tasks.go`, `tasks/executor.go`, `tasks/implement_run.go`, `tasks/run_plan.go`, ADR-0267 |
| `docs/spec/04-attempt.md` | `tasks/attempts.go`, `tasks/prompts/agent.tmpl.md`, `tasks/implement_implementation_convention.go`, ADR-0211, ADR-0216, ADR-0259 |
| `docs/spec/05-retry.md` | `tasks/digest.go`, `tasks/attempt_cap_exhaustion.go`, pop ADR-0040, ADR-0190 (turn-cap lesson), ADR-0231 |
| `docs/spec/06-verify.md` | `tasks/verify.go`, `tasks/verify_phase.go`, `tasks/verify_report.go`, `tasks/pass_report.go`, `tasks/prompts/verifier.tmpl.md`, `conventions/shipped/verification.md`, ADR-0096, ADR-0109, ADR-0179, ADR-0227, ADR-0245 |
| `docs/spec/07-refine.md` | `tasks/refine.go`, `tasks/refine_phase.go`, `tasks/refine_commit.go`, `tasks/refine_episode.go`, `tasks/refine_mark.go`, `tasks/refine_pointer.go`, `tasks/pass_report.go`, `tasks/prompts/refiner.tmpl.md`, `conventions/shipped/implementation.md`, `conventions/overlay.go`, ADR-0226, ADR-0246, ADR-0247, ADR-0248, ADR-0252, ADR-0260 |
| `docs/spec/08-gates.md` | `tasks/gates.go`, `tasks/gate_menu.go`, `tasks/interrupt_gate.go`, `tasks/verify_gate.go`, `tasks/prompts/*-assistance.tmpl.md` |
| `docs/spec/09-prompts.md` | `tasks/prompts/*.tmpl.md` (all), `tasks/digest.go` (lesson strings), `conventions/shipped/implementation.md`, `conventions/shipped/verification.md` |
| `docs/spec/10-hosts.md` | pop's adapter-capability pattern (ADR-0165, ADR-0166, ADR-0190); the opencode column also tracks opencode v2.0.20 as installed (ADR-0014), which is not a pop source |
| `PARITY.md` | the whole of the above |

## Drift-guard checklist

Run at the end of every porting session:

- [ ] The storage-format text inside the plan and register skills is a
      **verbatim copy** of the contract section of `docs/spec/01-storage.md`.
      The copy is shared: it lives at
      `skills/register/references/format-contract.md` (below its header, in
      the root `skills/` directory both hosts load — the Claude Code plugin
      through a symlink, the opencode plugin by its resolved root), and the
      plan skill reads that same file.
      (Pop generates its authoring guide from validator constants; cook cannot
      generate, so this manual check is the honest substitute. If drift ever
      bites, a generator script is the v2 answer.)
- [ ] Every prompt in the shipped `prompts/` directory still matches
      `docs/spec/09-prompts.md`, cook-marked edits included (the `[COOK: …]`
      markers stay in the shipped source; rendering strips them).
- [ ] Every file in `conventions/` is pop's `conventions/shipped/` file of
      the same name with only the edits `docs/spec/09-prompts.md` §11
      records: `diff` each against pop's copy. These files carry no markers,
      because agents read them as they are.
- [ ] Every divergence discovered while porting is either resolved or added
      to the marked-divergences table.
- [ ] Every row of `docs/spec/10-hosts.md`'s capability matrix declares one of
      the three values, and every row cook's own logic never reads is
      **Human-facing**, not Supported. (The loop-hardening row, dropped since
      by ADR-0015, was Supported for its whole life while the section under
      it said correctness never depends on it — this check is what would have
      caught that; ADR-0009.)
- [ ] `PROVENANCE.md` still describes the vendored companion skills
      truthfully: run its re-sync `diff` against a fresh upstream clone. Empty
      output passes; otherwise re-sync and advance the recorded version,
      commit, and copy date in the same commit. No vendored file carries a
      local edit (ADR-0010 — an edit turns every future re-sync into a merge).
      A daily GitHub Action already runs this check and opens a pull request
      when it fails, so in practice this item is "no open re-sync PR".
- [ ] The opencode column of `docs/spec/10-hosts.md`'s capability matrix
      (and `skills/drain/references/host-opencode.md`) still matches opencode
      as installed: run `opencode/smoke-test.sh` and expect `SMOKE OK`. It
      checks the plugin load, the six `cook:<verb>` commands and eight
      `cook/<dir>` skills, the `subagent` round-trip and its `completed`
      wrapper, a write-and-shell child, and a dismissed headless `question`.
      Cook depends on opencode's tool shapes here, and nothing but this check
      notices when a release moves them; a version other than 2.0.20 is a
      prompt to re-pin the plugin dependency and re-read the V2 docs.
- [ ] Each opencode command mirrors its Claude Code command:
      `opencode/commands/<verb>.md` says what `claude-code/commands/<verb>.md`
      says (skill or reference to read, force rules, the
      delivery-note line), with only the path spelling (`${COOK_ROOT}` for
      `${CLAUDE_PLUGIN_ROOT}`, and absolute where Claude Code's is relative),
      the host's own delivery note, and two host-only gaps differing: no
      `argument-hint` (opencode commands carry none) and, in `plan.md` only,
      the paragraph naming the `cook/`-prefixed companion skill ids.
      `diff` each pair; an edit to one side lands on the other in the same
      commit.
- [ ] The watermark is advanced.

## Sources in pop

- The repository at `../pop`, watermark `af9826ef`. Pop's glossary is
  `GLOSSARY.md` since pop ADR-0285 (it was `CONTEXT.md`); cook's own glossary
  keeps the name `CONTEXT.md`, which its vendored companion skills read.
- pop `CLAUDE.md` / `docs/agents/navigation.md` — the package map the
  doc-to-source table's paths come from.
- pop ADRs cited per-row above: 0040, 0096, 0109, 0165, 0166, 0179, 0190,
  0211, 0216, 0226, 0227, 0231, 0245, 0246, 0247, 0248, 0252, 0259, 0260,
  0267. ADR-0207 (planned subjects) is a stub in pop now, superseded by
  ADR-0211; ADR-0214 (code review) is superseded by ADR-0252.
- Deferred features: ADR-0238/0239/0240, 0258, 0262, 0276, 0286/0287.
- ADR-0284 (the Verifier checks every clause of a criterion) — ported in doc 06
  and doc 09 §3.
