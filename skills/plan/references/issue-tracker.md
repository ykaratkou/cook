# Issue-tracker adapter: cook's task-set store

This is the adapter doc `/cook:plan` hands to the `to-tickets` companion
skill (the same store-selection mechanism those skills already use), so the
decomposition publishes a cook-shaped task set instead of tickets in an
external tracker.

## The store

- **Location**: `.cook/tasks/<set-id>/` in the target repository. `<set-id>`
  is a lowercase kebab-case slug, unique under `.cook/tasks/`, and is the
  set's identity everywhere (commands, commit trailers, gates).
- **One ticket = one task file** (`NN-slug.md`) plus one entry in the set's
  `manifest.json` tasks array, in authored order.
- **The format contract** — manifest fields, task-file shape (`## What to
  build`, the optional `## Orientation`, `## Acceptance criteria`
  checkboxes), AFK/HITL typing rules — is
  the register skill's contract:
  `skills/register/references/format-contract.md` (a verbatim copy of cook
  spec `docs/spec/01-storage.md`). It is authoritative; follow it for every
  file written.
- The planning spec is co-located as `spec.md` in the set directory
  (context only for cook's Verifier/Refiner; the task files' acceptance
  criteria remain authoritative).
- The interview's decision drafts sit in the set directory's `adrs/` and
  `context/` sub-directories, written before the manifest (see "Mint
  checkboxes").

## Shape requirements

- AFK tasks: small vertical slices, each doable by a fresh-context agent
  without asking, each with at least one acceptance checkbox.
- HITL tasks: **only human work** (verification, decisions, sign-off);
  agent-doable prep belongs in a separate AFK task the HITL task is
  `blocked_by`. Canonical shape: a single terminal HITL sign-off task,
  blocked by every AFK task in the set.
- Publish each file — `manifest.json`, every task file, `spec.md` — through
  cook's cook-state read and mutation capability (the host's delivery note
  names the mechanism), one write per file, rather than generating the set
  with a script.
- Publishing here is *drafting*: the set counts as registered only when
  `/cook:register` (or plan's self-validation) derives READY.

## Mint checkboxes

A set carries decision drafts when its plan drafted ADRs or glossary changes
(`.cook/tasks/<set-id>/adrs/`, `.cook/tasks/<set-id>/context/`), or when it
is Map-sourced (the Map's `adrs/` and `context/`). The rules for drafts are
[decision-drafts.md](decision-drafts.md); here is how they reach the tasks.

- **The implementing task Mints.** Each draft goes to the task that
  implements the decision it records, as one checkbox under
  `## Acceptance criteria`, with the draft path written out in full:
  - `- [ ] docs/adr/NNNN-<slug>.md created from <draft path> (next free ADR number)`
  - `- [ ] <draft path> applied to the glossary`
- **Exactly one task per draft**, across every set its source spawns. A
  context draft whose terms land with different tasks may be split into one
  file per task under the same `context/` folder before the checkboxes are
  written; each piece is then its own draft.
- **Later tasks cite the draft path**, never an ADR number: the number does
  not exist until the Minting task picks it.
- Publishing the set mints nothing: the implementing task does, so the
  decision lands in the same commit as the change it describes.

## Map-sourced sets

A set is Map-sourced when `/cook:map <map-id> handoff` started the plan. The
source is the Map at `.cook/maps/<map-id>/`, not a conversation.

- **One set for the whole Map.** Never split it by area: the sequencing
  already lives in the ticket answers.
- **Mint checkboxes** (above) for each resolved ticket that links drafts
  from its `## Answer`, with the Map path written out:
  - `- [ ] docs/adr/NNNN-<slug>.md created from .cook/maps/<map-id>/adrs/NN-<slug>.md (next free ADR number)`
  - `- [ ] .cook/maps/<map-id>/context/NN-<slug>.md applied to the glossary`

  A ticket ruled out of scope mints nothing.
- **Lineage.** `spec.md` starts with `Source map: <map-id>`. The map skill
  writes that line and the Map's `Spawned sets` entry once the set derives
  READY.

## Sources

`docs/spec/01-storage.md`, `docs/spec/10-hosts.md`, and `docs/spec/11-map.md`
in the cook repository (pop sources in their footers; the adapter-doc
mechanism is pop's `integrate/issue-tracker.md`, and the Map-sourced rules its
`conventions/shipped/issue-tracker.md`). Mint checkboxes on a plan's own
drafts are cook's (ADR-0018).
