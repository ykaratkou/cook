# 11 — Map: Wayfinding with `/cook:map`

A **Map** charts work too big for one agent session: a Destination, the
Decision tickets that stand between here and it, the Fog beyond them, and what
is out of scope. `/cook:map` charts a Map, resolves its tickets, and hands the
finished Map to `/cook:plan`'s decomposition as one Task set. Wayfinding
produces decisions, not deliverables; the Drain builds what the Map decided.

Terms are `CONTEXT.md`'s `### Wayfinding` section. The decision is ADR-0017.

## Composition

`/cook:map` is built like `/cook:plan` (ADR-0010): upstream skills vendored
verbatim, adjusted from outside.

| Piece | Kind | Role |
| --- | --- | --- |
| `skills/wayfinder/` | vendored, verbatim | The Wayfinding skill: charting, working a ticket, ticket types, Fog, out of scope. |
| `skills/research/` | vendored, verbatim | Resolves a research ticket, in a subagent. |
| `skills/prototype/` | vendored, verbatim | Resolves a prototype ticket, with the human. |
| `skills/map/SKILL.md` | cook-owned | Pop's adjustments: mode dispatch, Assist, the grilling rules, per-type overrides, AFK fan-out, the self-check, handoff. Wins wherever it contradicts the vendored text. |
| `skills/map/references/wayfinding-operations.md` | cook-owned | The tracker doc the vendored `wayfinder` asks for: where a Map lives and how each operation is a file edit. |
| `skills/plan/references/issue-tracker.md` | cook-owned, extended | Gains a "Map-sourced sets" section for handoff (Mint checkboxes, lineage). |

The vendored copies follow `PROVENANCE.md`'s verbatim rule: no local edit, and
the re-sync covers the three new directories.

The vendored `wayfinder` keeps upstream's `disable-model-invocation: true`.
The `/cook:map` command therefore has the map skill **read it by path**, never
invoke it through the host's skill tool. Its references to
`/setup-matt-pocock-skills` never apply: the tracker doc is always supplied.

## The command

One verb, four forms. The argument decides the mode:

| Form | Mode |
| --- | --- |
| `/cook:map` | **List**: every Map with its Status, Destination, and counts of open, Frontier, and resolved tickets. Read-only. |
| `/cook:map <map-id> [NN]` | **Work**: when `.cook/maps/<map-id>/` exists. `NN` names a ticket; without it the session picks (see Work). |
| `/cook:map <map-id> assist` | **Assist**: change the Map; resolve nothing. |
| `/cook:map <map-id> handoff` | **Handoff**: turn the Map into one Task set. |
| `/cook:map <loose idea>` | **Chart**: any argument that does not name an existing Map. |

Out-of-scope rulings, abandoning a Map, and reopening one are not verbs. The
human asks for them in any session on the Map, and the agent edits the files
(see In-session acts).

## Storage

```
<repo>/.cook/maps/<map-id>/
├── map.md                        # the Map: status line + five sections
├── issues/NN-<slug>.md           # one Decision ticket per file, numbered from 01
├── adrs/NN-<slug>.md             # ADR drafts, named after their ticket
├── context/NN-<slug>.md          # Context drafts, one per ticket
└── prototypes/NN-<slug>/         # prototype artifacts
```

`<map-id>` is a lowercase kebab-case slug, unique under `.cook/maps/`, as a
set id is under `.cook/tasks/`. A Map's files sit under `.cook/` like a Task
set's; whether they are committed is the repository's choice. "Nothing
written to the repository" in this doc means nothing outside `.cook/maps/`.

Every write to a Map file goes through the **Cook-state read and mutation**
capability (doc 10), one write per file per change. No script generates Map
files.

### `map.md`

```markdown
Status: active

## Destination

<one or two lines: the spec, decision, or change this Map finds its way to>

## Notes

<domain; skills every session should consult; standing preferences>

## Decisions so far

- [<ticket title>](issues/NN-<slug>.md): <one-line gist of the answer>

## Not yet specified

<the Fog: in-scope questions not yet sharp enough to ticket>

## Out of scope

- [<ticket title>](issues/NN-<slug>.md): <gist, and why it is past the Destination>

## Spawned sets

- <set-id>
```

- `Status:` is the first line: `active` (default; a missing line reads as
  `active`), `arrived`, or `abandoned`. Declared by the human's act, never
  derived: an empty Frontier is not arrival, because Fog may remain.
- `Decisions so far` lists resolved tickets only, one line each, in
  resolution order. A decision lives in its ticket; the line only gists and
  links it.
- `Out of scope` lists tickets ruled out of scope. It is never part of the
  decision index.
- `Spawned sets` is written by Handoff only.

### Decision tickets

```markdown
Type: grilling
Status: open
Blocked by: 02, 05

# <ticket title>

## Question

<the decision or investigation this ticket resolves>

## Answer

<written on resolution: the decision, a one-line why, links to its drafts and assets>
```

- `Type:` is `research`, `prototype`, `grilling`, or `task`.
- `Mode:` follows `Type:` on a `task` ticket only: `afk` when the agent can do
  the work alone, else `hitl` (the default when absent). Research is always
  AFK; grilling and prototype are always HITL.
- `Status:` is `open`, `resolved`, or `out-of-scope`. There is no claimed
  state.
- `Blocked by:` lists ticket numbers; omitted or empty when unblocked.
- `## Answer` is absent until resolution. Resolving again replaces it.

### The Frontier

A ticket is **unblocked** when every ticket it lists is `resolved` or
`out-of-scope`. The **Frontier** is every `open`, unblocked ticket, in number
order.

## Modes

### Chart

Follows the vendored skill's *Chart the map*, with these adjustments:

1. Name the Destination, then map the Frontier breadth-first, using the
   grilling rules below (never `grill-with-docs` or `domain-modeling`).
   If no Fog surfaces, the work fits one session: stop and offer
   `/cook:plan` instead.
2. Pick the `<map-id>` and write `map.md`, then every ticket that can be
   specified now, then the `Blocked by:` lines in a second pass.
3. Fire one fresh-context subagent per research ticket, in parallel. Each
   runs the vendored `research` skill on its ticket's question and returns
   its findings with citations. The session, not the subagent, writes each
   ticket's `## Answer`, sets `Status: resolved`, and adds its line to
   `Decisions so far`. No branch.
4. Run the self-check. Charting resolves no non-research ticket.

### Work

1. Read `map.md` and the ticket files' header lines. Read a ticket's body
   only when it is needed.
2. **AFK fan-out.** Unless the human named a ticket, send every AFK ticket on
   the Frontier (research, and task with `Mode: afk`) to its own
   fresh-context subagent, in parallel. The session writes each returned
   answer, as in Chart step 3. Resolutions can unblock more AFK tickets;
   repeat until the Frontier holds no AFK ticket.
3. **One HITL ticket.** Take the named ticket, else the first HITL ticket on
   the Frontier. Resolve it with the human under its type's rules. If no HITL
   ticket is on the Frontier, report what the fan-out resolved and stop.
4. Record the resolution: `## Answer`, `Status: resolved`, and its line in
   `Decisions so far`.
5. Graduate Fog the answer made specifiable into new tickets, removing each
   patch from `Not yet specified`. Update or rule out any ticket the decision
   invalidated.
6. Run the self-check.

A session resolves at most **one HITL ticket**. AFK tickets have no such
limit. A named AFK ticket is resolved alone, in a subagent, with no fan-out.

### Assist

A session over the whole Map with no ticket in hand, for an idea that does not
fit one ticket: new scope, a fresh ticket, a patch of Fog, a ticket past the
Destination, a redrawn Destination.

- It may create and amend tickets, wire and unwire `Blocked by:`, edit the
  prose sections, and make out-of-scope rulings.
- It **resolves nothing**: no `## Answer`, no `Status: resolved`, no line in
  `Decisions so far`. When the conversation wants a decision made, it names
  the ticket and tells the human to run `/cook:map <map-id> <NN>`, then stops.
- It ends with the self-check.

### Handoff

1. Read `map.md` and every ticket. If any ticket is `open`, or
   `Not yet specified` is non-empty, say so and ask the human to confirm.
   Arrival is the human's judgment; nothing blocks it.
2. Run `skills/plan/SKILL.md`'s procedure from the Spec step on, skipping the
   Interview: the decisions are the Map. The conversation context `to-spec`
   synthesises from is the Destination, `Decisions so far`, and every
   resolved ticket's question and answer. The whole Map becomes **one** Task
   set; never pre-split it by area.
3. `to-tickets` follows the adapter doc's "Map-sourced sets" section:
   - Each task implementing a ticket that has drafts gets one Mint checkbox
     per draft under `## Acceptance criteria`:
     - `- [ ] docs/adr/NNNN-<slug>.md created from .cook/maps/<map-id>/adrs/NN-<slug>.md (next free ADR number)`
     - `- [ ] .cook/maps/<map-id>/context/NN-<slug>.md applied to the glossary`
   - Each draft is minted by exactly one task across every set the Map spawns.
   - The handoff session mints nothing itself.
4. Once the set derives READY: `Source map: <map-id>` becomes `spec.md`'s
   first line, `- <set-id>` is appended to `Spawned sets`, and `Status:`
   becomes `arrived`.

A Map may spawn a further set later, for example a remediation set. Handoff
then appends one more `Spawned sets` line and leaves `Status:` alone.

### List

Reads each `.cook/maps/*/map.md` and its tickets' header lines; prints one row
per Map: id, Status, Destination (first line), open, Frontier, resolved.
`abandoned` Maps are listed last. Writes nothing.

## Resolving a ticket, by type

These override the vendored `wayfinder` and its skills wherever they differ.

- **Grilling (HITL).** Run the vendored `grilling` skill for the interview.
  Never `domain-modeling` or `grill-with-docs`: both write into the
  repository. Read the repository's glossary and challenge the human's terms
  against it. Then write only inside the Map:
  - Glossary changes the ticket settles go to `context/NN-<slug>.md`: the
    entries to add or replace, in the glossary's own format, and the terms to
    remove. Written at the close of each round that settled terms.
  - A decision that passes all three of the ADR tests (hard to reverse,
    surprising without context, the result of a real trade-off) goes to
    `adrs/NN-<slug>.md`, in full, in the vendored `ADR-FORMAT.md` structure
    with no number. Never cite an ADR number for it.
  - The answer links each draft; it never inlines one.
  - Before the first round, read what this ticket already has (answer,
    drafts, prototype). Continue each file in place; never start a second
    draft beside one.
  - No commit, and no write outside the Map, at any point.
- **Research (AFK, subagent).** The vendored `research` skill, told to return
  its findings instead of saving a file. Findings, with a citation per claim,
  become `## Answer`. No branch.
- **Prototype (HITL).** The vendored `prototype` skill, with its artifact in
  `prototypes/NN-<slug>/`. The answer holds the path and the verdict. No
  branch, no commit, no change to the real code.
- **Task.** `Mode: afk` runs in a subagent; `Mode: hitl` hands the human a
  precise checklist. The answer records what was done and every fact later
  tickets depend on.

## In-session acts

In any session on the Map, at the human's request:

- **Rule a ticket out of scope**: `Status: out-of-scope`, the reason as its
  `## Answer`, and its line under `Out of scope`. Never in `Decisions so far`.
  Its drafts, if any, are not minted.
- **Abandon the Map**: `Status: abandoned`.
- **Reopen the Map**: `Status: active`.

## The self-check

Every session that wrote to the Map ends by re-reading it and fixing, before
it stops:

- every `issues/` file is named `NN-<slug>.md`, with unique numbers;
- every ticket has a valid `Type:` and `Status:` (and `Mode:` only on `task`);
- every `Blocked by:` number names an existing ticket, and no ticket blocks
  itself;
- every `resolved` ticket has an `## Answer` and a `Decisions so far` line,
  and every `out-of-scope` ticket an `## Answer` and an `Out of scope` line;
- every file under `adrs/` and `context/` is linked from its ticket's answer;
- `map.md`'s `Status:` is one of the three words.

## Concurrency

There are no claims and no locks. Two sessions may work one Map when they
resolve different tickets: the human names a ticket in each. Both append to
`map.md`, which is one write each; nothing detects a collision. Subagents
never write Map files; their session does.

## Hosts

| | Claude Code | opencode |
| --- | --- | --- |
| Command | `claude-code/commands/map.md` → `/cook:map` | `opencode/commands/map.md`, registered as `cook:map` |
| Map skill | `cook:map`, `user-invocable: false`, `disable-model-invocation: true`; loaded by path | `cook/map`, autoinvoke off |
| Vendored `wayfinder` | `cook:wayfinder`; upstream's `disable-model-invocation` holds; read by path | `cook/wayfinder`, autoinvoke **off** (opencode ignores the flag) |
| Vendored `research`, `prototype` | `cook:research`, `cook:prototype`, model-invocable | `cook/research`, `cook/prototype`, autoinvoke on |
| AFK subagents | Agent tool | `subagent` tool, `agent: "general"` |

The map skill reaches every vendored skill **by path** (`../wayfinder/`,
`../grilling/`, `../research/`, `../prototype/`), on both hosts and in the
subagents it spawns, so no command needs the host's skill ids.

## Not ported

From pop's Wayfinding, deliberately: `index.json` and the generated regions of
`map.md`; `pop map register`; claims and their liveness; Map sessions, `next`
pane spawning, and `fan-out` as tmux panes (AFK fan-out is subagents); the
Work dashboard's Map rows and detail view; archive and unarchive; the
set-side `planning_sources` link (Planning sources is deferred); the
writing-convention step (the Writing convention is deferred).

## Sources in pop

- `GLOSSARY.md` `### Wayfinder` — Wayfinding, Map, Decision ticket, Frontier,
  Map status, Arrived, Map assist, Ticket resolution, Out-of-scope ruling,
  Spawned set, Source map, ADR draft, Context draft, Mint
- `docs/adr/0129`, `0171`, `0172`, `0184`, `0186`
- `integrate/skills/pop/wayfinder/SKILL.md` (the overlay: Assist, skill and
  invocation deltas), `integrate/skills/pop/grill-with-map/SKILL.md`
- `conventions/shipped/issue-tracker.md` — "Wayfinding operations" and
  "Map-sourced sets"
- `wayfinder/` (`manifest.go`, `parse.go`, `frontier.go`, `resolution.go`,
  `register.go`) — the validation rules the self-check keeps, and the
  Frontier rule that out-of-scope tickets unblock their dependents
- Upstream `mattpocock/skills` at the commit `PROVENANCE.md` records:
  `engineering/wayfinder`, `engineering/research`, `engineering/prototype`,
  `engineering/setup-matt-pocock-skills/issue-tracker-local.md`
- Ported up to the watermark commit recorded in `PARITY.md`.
