# Grill session 0001 — cook's scope and architecture

- **Date**: 2026-08-20
- **Participants**: Evgeny (decisions), Claude (interviewer, grill-with-docs)
- **Subject**: Rebuilding pop's task-set implement feature as "cook", an
  in-agent plugin, docs-first, continuously ported from pop.

Settled decisions, in the order they were grilled. Where the user diverged
from the recommendation, both are noted.

## Round 1 — root decisions

1. **Q1 Architecture**: In-agent plugin (not a ported external orchestrator).
   Claude Code first, Pi later. Goal: a portable harness without extra
   dependencies. Accepted costs named up front: soft cap enforcement,
   model-driven loop reliability (mitigated by files-as-truth re-entrancy),
   host capability variance.
2. **Q2 "Ralph loop" meaning**: Both the whole drain loop *and* the
   verify→remediate tail — i.e. full feature parity. The word "ralph" itself
   is banned from cook's vocabulary (as in pop ADR-0190).
3. **Q3 Deliverable**: Docs only for now; implementations later, judged
   against the spec.
4. **Q4 Parity scope**: IN = storage contract, Verifier, gates, retry digest
   (+ turn-cap lesson), **and Reviewer** (user added it over the
   recommendation to defer). OUT = agent fallback/quota, worktrees/fold,
   captured-run telemetry/spend.
5. **Q5 Targets**: Claude Code + Pi. Spec is language-agnostic.
6. **Q6 Vocabulary**: Exactly pop's glossary, imported verbatim; "ralph"
   banned with an alias note.
7. **Q7 Porting mechanism**: Parity ledger (PARITY.md) with per-doc "Sources
   in pop" footers and a watermark commit; designed so automation can be
   bolted on later.

## Round 2 — architecture layer

8. **Q8 Loop driver**: Deferred pending a Pi capability fact-check (see 22).
9. **Q9 Storage**: No pop dependency at all, no pop↔cook interop; formats
   need not be byte-identical. Resolved at Q17.
10. **Q10 Attempt contract**: Pop's sentinels verbatim — `SUMMARY_START…
    SUMMARY_END`, `TASK_COMPLETE` / `TASK_FAILED: <reason>`,
    unchecked-boxes-means-failed. Prompt divergences must be marked edits,
    never paraphrases.
11. **Q11 Digest substrate**: Slim per-attempt records (ordinal, outcome,
    reason, narrative tail) — not full captured-run telemetry. The lessons
    table ports verbatim.
12. **Q12 Gates**: In-session stops using the host's structured ask; pop's
    assistance prompts become gate instruction blocks, including both
    "the human decides" partials, now governing the orchestrator itself.
13. **Q13 Caps**: `max_tries` orchestrator-checked; Turn cap and timeout
    declared Blind on both hosts (pop's capability-declaration pattern,
    ported as the host matrix). Retry delays default-off as an ADR'd
    departure.
14. **Q14 Verifier/Reviewer independence**: Fresh-context subagent, zero
    shared conversation state; weakened form (same model) ledgered.
    Fetch-the-diff-yourself prompt design kept verbatim.
15. **Q15 Commits**: Explained in detail, then settled at Q18.
16. **Q16 Doc layout**: `CONTEXT.md`, `PARITY.md`, `docs/adr/`, `docs/grill/`,
    `docs/spec/00–10`. Confirmed as proposed.

## Round 3 — leaves

17. **Q17 Storage format**: Pop's *shape* with cook-owned names — manifest
    JSON + one `.md` per task + `progress.txt` journal + `state.json`
    sidecar, under `.cook/tasks/<set-id>/` in the target repo. (Option (a);
    consolidation and radical simplification rejected.)
18. **Q18 Commit behavior**: Pop's five steps verbatim — assessment → no-op
    check → `add -A` + three-paragraph commit (planned subject fallback,
    summary body, task trailer) → set-base capture → atomic finalize
    (write-temp-then-rename replaces the DB transaction). `continue` dirty
    strategy only.
19. **Q19 Command surface**: plan, register, implement, status, verify,
    review — explained in simple words; user's follow-up confirmed the
    automatic tail: implement runs verify → (FIXABLE ⇒ auto-remediate and
    loop) → review → HITL gate, with verify/review verbs kept as manual
    force buttons.
20. **Q20 Attended-only v1**: Confirmed after explaining pop's actual
    unattended machinery (a supervisor daemon, not hooks or cron). Headless
    gate semantics ("stop and report, never auto-decide") spec'd dormant.
21. **Q21 Config**: `.cook/config.json`. **User diverged from pop's
    defaults**: verify ON and review ON by default (pop: off) — recorded as
    marked divergences in the ledger.

## Round 4 — post-fact-check and closing

22. **Q22 Loop driver (final, after Pi research)**: Portable core is a
    markdown skill set (both hosts implement the agentskills standard);
    attempts/Verifier/Reviewer are fresh-context subagents — Claude Code via
    the built-in Agent tool, Pi via one small TS extension wrapping its
    first-party subagent pattern. Per-host loop hardening (stop hook /
    `agent_settled`) optional, not required for correctness.
23. **Q23 Prompt files**: Separate template files in a shared `prompts/`
    directory, pop's filenames kept, `{{name}}` placeholders; porting a
    prompt change = diffing two same-named files.
24. **Q24 Set selection**: `priority` number in each set's manifest, ties by
    set-id, missing = 0. (No central registry.)
25. **Q25 Sidecar state**: `state.json` = verdict cache (verdict + judged SHA
    + findings), verification episode fingerprint (hash of done-AFK
    composition), review episode fingerprint (done-AFK task ids), per-task
    attempt counters, remediation depth used. Attempt records beside it.
26. **Q26 Repo layout long-term**: One repo, `../cook`: `docs/` shared spec +
    `claude-code/` + `pi/` implementations + one shared `prompts/` directory
    (never duplicated per host).
27. **Q27 Plan verb**: `/cook:plan` added — a thin orchestrator that triggers
    grill-with-docs first, then to-spec and to-tickets at the end, publishing
    into cook's store via a cook-shipped issue-tracker adapter doc. Those
    three are companion skills cook requires but does not ship.
28. **Q28 Drift guard**: The plan/register skills' format text must be a
    verbatim copy of `01-storage.md`'s contract section, checked every
    porting session via the PARITY.md checklist.

## Naming (final)

The bare **`/cook`** is the drain verb (implement); all others are
namespaced: `/cook:plan`, `/cook:register`, `/cook:status`, `/cook:verify`,
`/cook:review`. Both hosts support the mapping (Claude Code resolves an
unambiguous plugin command without its namespace; Pi commands are
filename-named).

## Facts gathered during the session

- `../cook` was empty at session start.
- Pi (pi-coding-agent v0.84.2): implements the agentskills standard; no
  built-in subagent but a first-party subagent-extension pattern spawning
  headless `pi --mode json` children; `agent_settled` + `sendUserMessage()`
  as a native loop re-injection point; `ctx.ui.select/confirm/input` for
  structured gates; headless children sealable via `--no-session
  --no-extensions --no-skills --no-context-files --tools`.
- Pop's commit machinery, digest lessons table, prompt templates, and gate
  set were read from source and are cited per-doc in PARITY.md.
