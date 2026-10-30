# Issue tracker: cook Maps

This is the tracker doc the vendored `wayfinder` skill asks for. Cook's Maps
are local markdown under `.cook/maps/`; there is no external tracker, and
`/setup-matt-pocock-skills` never applies. Spec: `docs/spec/11-map.md`.

## Wayfinding operations

Used by `/cook:map`. The **map** is a file with one **child** file per ticket.

- **Map**: `.cook/maps/<map-id>/map.md`. `<map-id>` is a lowercase kebab-case
  slug, unique under `.cook/maps/`. The first line is `Status: active`
  (`arrived` or `abandoned` later; a missing line reads as `active`), then the
  sections `## Destination`, `## Notes`, `## Decisions so far`,
  `## Not yet specified`, `## Out of scope`, `## Spawned sets`, in that
  order.
- **Child ticket**: `.cook/maps/<map-id>/issues/NN-<slug>.md`, numbered from
  `01`. Header lines at the top, then `# <title>`, then `## Question`:
  - `Type:` — `research`, `prototype`, `grilling`, or `task`. This line is the
    ticket's `wayfinder:<type>` label.
  - `Mode:` — on a `task` ticket only: `afk` if the agent can do the work
    alone, else `hitl` (the default when absent).
  - `Status:` — `open`, `resolved`, or `out-of-scope`. There is no `claimed`.
  - `Blocked by:` — ticket numbers, comma-separated; omitted when unblocked.
    This line is the ticket's blocking relationship.
- **Blocking**: a ticket is unblocked when every ticket it lists is
  `resolved` or `out-of-scope`.
- **Frontier**: scan `issues/` for files that are `open` and unblocked; first
  by number wins.
- **Claim**: none. Do not write a claim. Parallel sessions on one Map name
  different tickets; that is the human's to keep.
- **Resolve**: write the answer under `## Answer` at the end of the ticket
  (replacing any earlier one), set `Status: resolved`, then append
  `- [<title>](issues/NN-<slug>.md): <one-line gist>` to `Decisions so far`.
- **Rule out of scope**: write the reason under `## Answer`, set
  `Status: out-of-scope`, then append
  `- [<title>](issues/NN-<slug>.md): <gist, and why it is past the Destination>`
  to `Out of scope`. Never to `Decisions so far`.
- **Assets**: ADR drafts at `adrs/NN-<slug>.md`, Context drafts at
  `context/NN-<slug>.md`, prototypes under `prototypes/NN-<slug>/`, each named
  after its ticket and linked from that ticket's `## Answer`. Nothing is
  written outside `.cook/maps/<map-id>/`, and nothing is committed.
- **Writes**: one write per file per change, through the cook-state read and
  mutation capability (your host's delivery note names it).
