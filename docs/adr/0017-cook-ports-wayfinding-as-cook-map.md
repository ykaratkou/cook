---
status: accepted
date: 2026-10-30
---

# Cook ports wayfinding as `/cook:map`

Cook's charter was pop's task-set *implement* feature (ADR-0001, doc 00).
Its front door, `/cook:plan`, grills one feature in one session. Some work is
too big for one session: the way to the end is not visible yet, and grilling
it in one sitting either runs out of context or commits decisions before the
questions behind them are known. Pop answers that with **Wayfinding**: a Map
of Decision tickets, resolved one per session until the way to a Destination
is clear, then handed off whole to one Task set.

Pop's Wayfinding is two layers. The skill text is Matt Pocock's upstream
`wayfinder` skill, kept byte-verbatim under a pop overlay. The mechanics are
pop's binary: a JSON manifest per Map, `map.md` sections that only pop
rebuilds, claims held by a live tmux pane in pop.db, a registry, and about
fifteen `pop map` verbs (pop ADR-0172). Cook has no binary, no tmux layer and
no database.

We decided **cook ports Wayfinding as one verb, `/cook:map`**, built the way
`/cook:plan` is built (ADR-0010): upstream skills vendored verbatim, and
pop's adjustments applied from outside them (user decisions, 2026-10-30).

- **Vendored verbatim**: upstream `wayfinder`, plus `research` and `prototype`,
  which its ticket types call by name. Same pinned upstream commit as the
  existing five.
- **Pop's adjustments, cook-owned**: a `map` skill and a "Wayfinding
  operations" section in cook's adapter doc. They carry pop's Assist mode,
  pop's grilling rules for a Decision ticket (pop's `grill-with-map`, folded
  in rather than shipped as a skill), and pop's per-type overrides: research
  and prototype results land in the Map, never on a branch.
- **Upstream's local-markdown file shape**, not pop's manifest. A Map is
  `.cook/maps/<map-id>/` with `map.md` and one file per ticket carrying
  `Type:`, `Status:` and `Blocked by:` lines. There is no `index.json`, no
  generated region, and no register verb. Every session that edits a Map ends
  with a self-check of its files instead.
- **No claims.** Pop's claim frees itself when its pane dies, and pop refuses
  file-borne claims because nothing can release them. Cook has neither panes
  nor a database, so the Frontier is open and unblocked tickets only, and
  parallel sessions name distinct tickets.
- **Subagents instead of panes**, for agent-only work. Research tickets and
  AFK task tickets run as parallel fresh-context subagents; the session writes
  their answers. Grilling and prototype tickets are human-in-the-loop, so they
  run in the human's session, one per session.
- **Pop's repo-clean discipline**, adapted. While a Map is open, nothing it
  decides is written to the repository's docs or code: ADRs and glossary
  changes are drafted inside the Map and **Minted** later by the task that
  implements them, as an acceptance criterion (pop ADR-0171). Map files
  themselves live under `.cook/`, like Task sets, and may be committed.
- **Handoff is `/cook:plan` without the interview.** The whole Map becomes one
  Task set through `to-spec` and `to-tickets`, with Mint checkboxes on the
  implementing tasks. The link is two plain-text lines, one in each direction.

## Considered Options

- **Port pop's overlaid skill file as marked edits.** Rejected: upstream
  already routes every mechanic through the tracker doc's "Wayfinding
  operations" seam, so the adjustments fit outside the file, and the daily
  re-sync (ADR-0010) keeps the text current at no cost.
- **Port pop's manifest, generated regions, and verbs as agent procedures.**
  Rejected: each exists to serve something cook leaves out. The generated
  regions let parallel panes append to one index safely. The registry feeds
  the dashboard. The claim verbs serve tmux. Without those, upstream's
  file-per-ticket shape carries the same facts with one writer per edit.
- **Ship a helper script for the deterministic parts** (validation, Frontier,
  index). Rejected: two runtimes across two hosts, against ADR-0003's
  portable core, for files small enough to check by reading.
- **Store claims in the ticket file with a release verb.** Rejected: it
  restores the stale-claim failure pop designed out, to guard a race the
  human avoids by naming tickets (the stance ADR-0015 already takes for
  drains).
- **Let grilling write the glossary and ADRs directly**, as upstream and
  `/cook:plan` do. Rejected: a Map lives for days, and numbered ADRs for
  decisions a later ticket may reverse are the clutter pop's Mint exists to
  prevent. Minting costs the drain nothing, because it rides on acceptance
  criteria.
- **Keep Maps outside the repository**, as pop's Task storage does. Rejected:
  ADR-0002 keeps cook's state with the repository it describes.

## Consequences

- Cook's charter grows from "the implement feature" to "implement and
  Wayfinding". Doc 00, `CONTEXT.md` (a `### Wayfinding` section), and
  `PARITY.md` (an IN row, the doc-to-source entries) say so. The binding
  spec is `docs/spec/11-map.md`.
- Installing cook adds `research` and `prototype` to the skills the model may
  invoke on its own, as ADR-0010 already accepted for `grilling` and
  `domain-modeling`. The vendored `wayfinder` keeps upstream's
  `disable-model-invocation`, so `/cook:map` loads it by path. opencode
  ignores that flag, so its plugin registers `cook/wayfinder` with
  autoinvoke off.
- Pop's tmux surface (Map sessions, `next` pane spawning, `fan-out`), the
  Work dashboard rows, archive, and the claim are OUT. Abandoning a Map,
  reopening it, and ruling a ticket out of scope are things the human asks
  for inside a session, not verbs.
- Nothing detects two sessions resolving the same ticket. That race, and
  concurrent edits to one `map.md`, are the human's to avoid.
- Pop's `planning_sources` link from a set back to its Map is part of a
  deferred feature (Planning sources), so the set-side link is a
  `Source map:` line in `spec.md` that nothing parses.
- Pop's writing-convention step in its Wayfinding skills is left out with
  the Writing convention it reads (deferred in `PARITY.md`).

## Sources

- User decisions, 2026-10-30: the grilling session that settled vendor-and-
  adapt, one `/cook:map` verb, the local-markdown shape, no claims, subagents
  for AFK tickets, draft-then-Mint, and handoff through `/cook:plan`.
- Pop `GLOSSARY.md` `### Wayfinder`; pop ADR-0129 (Maps are a sibling of Task
  sets), ADR-0171 (Mint), ADR-0172 (pop owns the lifecycle), ADR-0184 (Map
  assist and the authoring contract); `integrate/skills/pop/wayfinder/SKILL.md`,
  `integrate/skills/pop/grill-with-map/SKILL.md`,
  `conventions/shipped/issue-tracker.md` ("Wayfinding operations",
  "Map-sourced sets").
- Upstream `mattpocock/skills` `engineering/wayfinder`, `engineering/research`,
  `engineering/prototype`, and `setup-matt-pocock-skills/issue-tracker-local.md`
  ("Wayfinding operations").
- Cook ADR-0002 (cook owns its formats), ADR-0003 (portable core), ADR-0010
  (vendored companions), ADR-0015 (no locks).
