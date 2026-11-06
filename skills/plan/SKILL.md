---
name: plan
description: Author a cook task set for a feature by orchestrating the companion skills grilling, to-spec, and to-tickets, drafting ADRs and glossary changes inside the set, then self-validating until the set derives READY. Loaded by the /cook:plan command.
user-invocable: false
disable-model-invocation: true
---

# Plan: author a task set

`/cook:plan <feature>` takes one feature from idea to a READY task set under
`.cook/tasks/<set-id>/`. The human touches the flow here (the interview) and
at the end (confirming the set); the decomposition in between follows the
companion skills.

## Companion skills — shipped with cook, not written by cook

Plan orchestrates three skills that ship alongside this one:

1. **grilling** — the design interview, run under cook's
   [decision-drafts rules](references/decision-drafts.md): ADRs and glossary
   changes it settles are written as drafts inside the set, never into the
   repository.
2. **to-spec** — turns the settled decisions into a spec document.
3. **to-tickets** — decomposes the spec into tickets/tasks.

They are verbatim copies of an upstream skill set (MIT), vendored as
sibling directories of this one — `../grilling/`, `../to-spec/`,
`../to-tickets/` — with `../domain-modeling/` supplying only the glossary and
ADR formats the drafts follow, so your host discovers them like any other
installed skill. See `PROVENANCE.md` at the repo root (ADR-0010). Three
consequences for this procedure:

- **Never improvise a substitute** interview, spec, or decomposition. If a
  companion will not load, that is a broken install: say so and stop.
  Hand-authoring against the format contract plus `/cook:register` is the
  human's fallback.
- **Never load `grill-with-docs` or `domain-modeling`** for the interview:
  both write the glossary and `docs/adr/` straight into the repository
  (ADR-0018). The decision-drafts rules keep their discipline instead.
- The copies mention `/setup-matt-pocock-skills`, a command cook does not
  ship. Ignore it — the tracker those skills ask about is supplied by cook's
  adapter doc in step 4, and never needs configuring.

## Procedure

1. **Name the set** — pick the `<set-id>` before anything is written: a
   lowercase kebab-case slug, unique under `.cook/tasks/`. If the human names
   an existing set whose folder holds drafts but no `manifest.json`, an
   earlier plan stopped mid-interview: resume it, and its drafts.
2. **Interview** — read `../grilling/SKILL.md` and run it on the feature,
   following [references/decision-drafts.md](references/decision-drafts.md)
   with `.cook/tasks/<set-id>/` as the drafts folder. Until step 4 writes
   the manifest, the set folder holds only drafts and derives MALFORMED;
   that is expected, and nothing drains it.
3. **Spec** — run to-spec on the settled decisions. Where the spec refers to
   a draft, it names the draft's path; it never cites an ADR number for one.
4. **Decompose** — run to-tickets, pointing it at cook's store via the
   adapter doc [references/issue-tracker.md](references/issue-tracker.md), so
   it publishes a cook-shaped set. Requirements for the result:
   - the `<set-id>` from step 1;
   - small **vertical-slice AFK tasks**, each self-containedly implementable
     by a fresh-context agent, each with at least one checkbox under
     `## Acceptance criteria`;
   - **Mint checkboxes** on the tasks that implement a drafted decision,
     one per draft, per the adapter doc's "Mint checkboxes" section;
   - an optional `## Orientation` section on each AFK task with a code
     surface: the files and symbols actually touched or read while planning,
     plus the exact build/test command that proves the slice — the one place
     paths belong, where the implementer's prior-art search starts. Never
     padded with guesses; omitted for a HITL sign-off;
   - a single **terminal HITL sign-off task**, blocked by every AFK task in
     the set (the canonical shape); HITL tasks contain only human work;
   - `blocked_by` capturing real prerequisites; manifest order as the
     authored sequence;
   - optional planned `commit_subject` per task; the planning spec co-located
     as `spec.md` (context only);
   - `manifest.json` per the format contract.
5. **Self-validate** — apply the register skill's validation
   (`../register/SKILL.md` with its
   [format contract](../register/references/format-contract.md)) and fix
   faults until the set derives **READY**. Fix the unminted-draft warning
   too: every draft gets exactly one Mint checkbox. Do not present a set that
   does not validate.
6. **Report** — the set id, the task listing (type, blocked_by), the drafts
   and the task that Mints each, and the next step: `/cook:drain <set-id>`.

**Map-sourced entry.** `/cook:map <map-id> handoff` names the set (step 1),
skips the interview (step 2), and continues from step 3: a Map's resolved
tickets are the decisions, and its drafts stay in the Map. The set it
produces is Map-sourced — follow the adapter doc's "Map-sourced sets"
section in step 4 (one set, Mint checkboxes on the Map's drafts). The map
skill records the lineage after step 5.

The format contract is authoritative for every file written here — when this
skill and the contract seem to disagree, the contract wins. Every file the
plan produces (`manifest.json`, each task file, `spec.md`, each draft) is
written through the cook-state read and mutation capability (your host's
delivery note names the mechanism), one write per file — not emitted by a
program authored to generate the set.

## Stops

Four times the plan ends its turn on a plain-text ask and waits for the
human, and a fifth when the human runs auto-grill on a grilling round and it
leaves judgement calls open. Each such turn ends with one more line, the **stop marker**
`Cook-Stop: <kind>`, so a program driving the session can tell which stop
it is (`docs/spec/10-hosts.md`, "Stop markers"; ADR-0019):

| Kind | The turn ends on |
| --- | --- |
| `questions` | a grilling round: the numbered questions with their recommendations |
| `confirm` | grilling's check that you have reached a shared understanding |
| `seams` | to-spec's check that the test seams match the human's expectations |
| `breakdown` | to-tickets' quiz on the proposed breakdown |
| `judgement` | auto-grill's answers to a grilling round, when it left judgement calls open for the human (its own rule, `../auto-grill/SKILL.md`) |

- The marker is always on, whoever is in the session, and it is the turn's
  **last line**, exactly `Cook-Stop: <kind>`: not in a code fence, not
  bold, nothing after it.
- One marker per turn, for the stop it ends on.
- A turn that does not end waiting on one of these carries no marker: the
  step 6 report, a broken-install stop, or a question outside these five.

## Sources

`docs/spec/00-overview.md` (the plan front door), `docs/spec/01-storage.md`
(the contract, decision drafts), `docs/spec/10-hosts.md` (companion skills,
adapter doc), and ADR-0018 in the cook repository; pop sources in their
footers.
