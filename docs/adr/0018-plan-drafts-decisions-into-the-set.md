---
status: accepted
date: 2026-11-01
---

# `/cook:plan` drafts its decisions into the set, and the tasks Mint them

`/cook:plan` interviewed with upstream's `grill-with-docs`, which is
`grilling` plus `domain-modeling`. `domain-modeling` writes as it goes: a
settled term becomes an edit to `GLOSSARY.md` (or `CONTEXT.md`) and a
decision becomes a numbered `docs/adr/NNNN-*.md`, straight into the working
tree. Cook's plan commits nothing, so those edits sat uncommitted until the
drain's `continue` strategy (doc 03) swept them into the first task's
commit, whichever task that was. Two plans in one repository edited the same
glossary and could pick the same ADR number. `/cook:map` already avoided all
of this (ADR-0017): its grilling writes **drafts** inside the Map, and the
task that implements each decision **Mints** it.

We decided **every `/cook:plan` drafts and Mints, the way a Map does**
(user decision, 2026-11-01).

- The interview runs `grilling` alone, under cook-owned **decision-drafts
  rules** (`skills/plan/references/decision-drafts.md`). They keep
  `domain-modeling`'s discipline (challenge terms against the glossary,
  sharpen fuzzy ones, scenarios, check the code) and its two formats, but
  never load the skill, because its instructions are to write the repository.
- Drafts live in the set: ADR drafts at `.cook/tasks/<set-id>/adrs/<slug>.md`,
  with no number; the Context draft at
  `.cook/tasks/<set-id>/context/<set-id>.md`, an Add / Replace / Remove edit
  in the glossary's own format. So the `<set-id>` is picked before the
  interview, not at decomposition.
- `to-tickets` puts one Mint checkbox per draft on the task that implements
  it, through the adapter doc's "Mint checkboxes" section, now shared by
  plan-sourced and Map-sourced sets. The implementer picks the ADR number
  and applies the glossary edit when it Mints.
- `/cook:map`'s grilling tickets follow the same rules file, with the Map as
  the drafts folder and `NN-<slug>` as the draft name, so the two paths
  cannot drift apart.
- `/cook:register` warns when a draft is named by no Mint checkbox, or by
  more than one (doc 01, rule 9).

## Considered Options

- **Keep `grill-with-docs`, then commit its edits at the end of the plan**,
  as pop's `grill-with-docs` does. Rejected: it fixes the swept-in commit but
  not concurrency (two plans still edit one glossary and race for an ADR
  number), and it lands the docs before the code they describe.
- **Load `domain-modeling` and override its writes from outside.**
  Rejected: an instruction to write the glossary inline, countermanded by
  another file, is the setup in which pop's grilling session wrote into the
  repository anyway (pop ADR-0171). Not loading it is the only reliable
  override.
- **Drafts in a shared `.cook/drafts/` folder.** Rejected: drafts belong to
  the set that Mints them, and a per-set folder is what keeps two plans
  apart.
- **Stop vendoring `grill-with-docs`.** Rejected for now: the upstream set
  stays whole, so the daily re-sync (ADR-0010) still diffs one tree. Nothing
  in cook loads it.

## Consequences

- A plan leaves the working tree untouched, and the glossary edit and ADR
  land in the commit of the task that implements them.
- Two plans can run in one repository at once, provided they pick different
  set ids. Two drains Minting at once could still pick the same ADR number;
  that is the one-checkout discipline ADR-0015 already relies on.
- A set folder in mid-interview holds drafts but no manifest, so it derives
  MALFORMED until decomposition writes one. Naming that set to `/cook:plan`
  again resumes its drafts.
- The spec and later tasks cite a draft by its path, never an ADR number:
  the number does not exist until the Minting task picks it.
- When two sets' Context drafts touch the same term, the second Mint
  reconciles against the glossary as it then stands. A real disagreement
  surfaces there, in that task's attempt, not at planning time.
- Cook diverges from pop here: pop's plan still writes and commits during the
  interview (`PARITY.md`, "Plan's decision records").

## Sources

- User decision, 2026-11-01: "teach cook plan to not create these ADRs or
  update the context yet but make it part of a ticket", so plans can run
  side by side.
- Cook ADR-0010 (vendored companions), ADR-0015 (no locks), ADR-0017 (Map
  drafts and Mint); docs 01, 03, 10, 11.
- Pop ADR-0089 (`.grill-context/` fragments), ADR-0171 (Mint through the
  implementing slice; the grilling session that wrote into the repository).
