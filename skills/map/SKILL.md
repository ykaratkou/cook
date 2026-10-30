---
name: map
description: Cook's Wayfinding — chart a Map of Decision tickets for work too big for one session, resolve them, and hand the Map off to one task set. Loaded by the /cook:map command; never start Wayfinding on your own initiative.
user-invocable: false
disable-model-invocation: true
---

# Map: Wayfinding

`/cook:map` charts work too big for one agent session as a **Map**: a
Destination, the Decision tickets between here and it, the Fog beyond them,
and what is out of scope. Its sessions resolve tickets until the way is
clear, then hand the whole Map to one task set. Wayfinding produces
decisions, not deliverables. The binding spec is `docs/spec/11-map.md` in
the cook repository; the terms are its glossary's `### Wayfinding` section.

## The skills this one adjusts

Wayfinding is upstream's `wayfinder` skill, vendored verbatim with cook as
`../wayfinder/SKILL.md`, adjusted by this file. **Read
`../wayfinder/SKILL.md` in full first.** It is marked manual-only, so read it
by path; never invoke it through your host's skill tool.

- Its tracker doc is
  [references/wayfinding-operations.md](references/wayfinding-operations.md).
  Wherever it says "the tracker doc's Wayfinding operations section", a
  label, an assignee, a comment, closing an issue, or a native blocking link,
  read that file. Ignore every mention of `/setup-matt-pocock-skills`.
- Where it says to call the Skill tool for `grilling`, `research`, or
  `prototype`, read cook's copy by path instead — `../grilling/SKILL.md`,
  `../research/SKILL.md`, `../prototype/SKILL.md` — and follow it under this
  file's rules. Never load `domain-modeling` or `grill-with-docs` in a Map
  session: both write into the repository.
- **Where this file and the vendored text disagree, this file wins.** The
  vendored text is kept byte-intact so upstream changes stay diffable.

## Dispatch

Read the argument and pick exactly one mode. Follow only that mode's section.

| Argument | Mode |
| --- | --- |
| empty | **List** |
| `<map-id>` naming an existing `.cook/maps/<map-id>/`, optionally followed by a ticket number | **Work** |
| `<map-id> assist` | **Assist** |
| `<map-id> handoff` | **Handoff** |
| anything else | **Chart**: the argument is the loose idea |

A ticket number may be written `3`, `03`, or as the ticket's filename.

## Chart

The vendored *Chart the map*, adjusted:

1. **Name the Destination**, then **map the Frontier** breadth-first, each
   under the grilling rules below. If no Fog surfaces — the work fits one
   session — stop and suggest `/cook:plan` instead.
2. **Create the Map**: pick a `<map-id>` not already under `.cook/maps/`,
   write `map.md` (Destination and Notes filled, Decisions so far empty, the
   Fog in Not yet specified), then each ticket you can specify now, then the
   `Blocked by:` lines in a second pass. Give every `task` ticket a `Mode:`.
3. **Resolve the research tickets** with the AFK fan-out below. No branch.
4. Run the **self-check**, then report the Map id, the Frontier, and the next
   step: `/cook:map <map-id>`. Charting resolves no other ticket.

## Work

1. Load the Map: `map.md` and the header lines of every ticket. Read a
   ticket's body only when you need it.
2. **A named ticket** is the one ticket this session resolves. If it is AFK
   (research, or task with `Mode: afk`), resolve it in one subagent as the
   fan-out does, then skip to step 5. A named ticket that is blocked: say
   which tickets block it and ask the human whether to go on.
3. **Otherwise, AFK fan-out first.** Resolve every AFK ticket on the
   Frontier at once, as the fan-out below describes. Resolutions can unblock
   more AFK tickets: repeat until the Frontier holds none.
4. **Then one HITL ticket**: the first grilling, prototype, or `Mode: hitl`
   task ticket on the Frontier. Resolve it with the human under its type's
   rules below. If the Frontier holds no HITL ticket, report what the
   fan-out resolved and what blocks the rest, and stop.
5. **Record the resolution** (wayfinding-operations.md, *Resolve*).
6. **Clear the Fog** the answer reached: graduate each patch of
   Not yet specified that is now sharp into a ticket, removing it from that
   section. Update tickets the decision changed; rule out of scope any that
   now sit past the Destination.
7. Run the **self-check**, then report what was resolved and the Frontier
   now.

**Never resolve more than one HITL ticket in a session.** AFK tickets have no
such limit.

## AFK fan-out

One fresh-context subagent per AFK ticket, all spawned together (your host's
delivery note names the spawn and its output). Each spawn's task text holds:

- the absolute paths of `map.md` and the ticket file, to read;
- for research: "Read `<absolute path of ../research/SKILL.md>` and follow
  it on the ticket's `## Question`. Do not save a file: return the findings
  as your final message, with a source cited for every claim.";
- for an AFK task: "Do the work the ticket's `## Question` describes. Return
  what you did and every resulting fact a later decision depends on.";
- in both: "Write no file under `.cook/`, and commit nothing."

You, not the subagent, write each returned answer: *Resolve* in
wayfinding-operations.md, one ticket at a time. A spawn that fails or returns
nothing usable leaves its ticket `open`; say so in your report.

## Assist

A session over the whole Map with no ticket in hand.

1. Load the Map as Work step 1 does, and show the human the Frontier.
2. Have the conversation, then write what it settles: create tickets
   (graduating Fog as you go), amend a ticket's `## Question`, wire or unwire
   `Blocked by:`, edit `map.md`'s Destination, Notes, and Not yet specified,
   and rule tickets out of scope.
3. **Resolve nothing**: no `## Answer` on an open ticket, no
   `Status: resolved`, no line in Decisions so far. When the conversation
   wants a decision made, name the ticket, tell the human to run
   `/cook:map <map-id> <NN>`, and stop.
4. Run the **self-check**.

## Resolving a ticket, by type

These replace the vendored *Ticket Types* wherever they differ.

### Grilling (HITL)

Read `../grilling/SKILL.md` and run its interview on this ticket's question.
A question that belongs to another ticket is Fog to name in the answer, not
a branch to walk here. The human answers for themselves; never answer your
own questions.

- **Before the first round**, read what this ticket already has: its
  `## Answer`, `adrs/NN-<slug>.md`, `context/NN-<slug>.md`,
  `prototypes/NN-<slug>/`. A prior session may have died mid-interview.
  Resume from where it leaves off, and continue each file in place; never
  start a second draft beside one.
- **Read the repository's glossary** (`GLOSSARY.md`, or `CONTEXT.md` where
  that is the file) before the first round, and challenge the human's terms
  against it.
- **Context draft.** At the close of each round that settled terms, write
  them to `context/NN-<slug>.md`: entries to add or replace, in the
  glossary's own format, and terms to remove. One file per ticket.
- **ADR draft.** Offer an ADR only when all three hold: hard to reverse,
  surprising without context, and the result of a real trade-off. When the
  human agrees, write it in full to `adrs/NN-<slug>.md` with the structure in
  `../domain-modeling/ADR-FORMAT.md`, ignoring that file's location and
  numbering rules. Never cite an ADR number for it; the number is picked
  when the draft is Minted.
- **Write only inside the Map.** No glossary edit, no `docs/adr/` file, no
  code change, and no commit, at any point. If you reach for `git add`, stop.
- **The answer** is the decision and a one-line why, linking each draft. It
  never inlines one.

### Research (AFK)

Resolved by a subagent, through the AFK fan-out. The findings, with their
citations, are the `## Answer`.

### Prototype (HITL)

Read `../prototype/SKILL.md` and follow it with the human, with these
changes: the artifact goes in `prototypes/NN-<slug>/` inside the Map; no
branch, no commit, and no change to the real code. The answer holds the
artifact's path and the verdict.

### Task

`Mode: afk` is resolved through the AFK fan-out. `Mode: hitl` hands the human
a precise checklist and waits until they say it is done. Either way the
answer records what was done and every fact later tickets depend on.

## In-session acts

In any session on a Map, when the human asks:

- **Rule a ticket out of scope** — wayfinding-operations.md, *Rule out of
  scope*. Allowed in Assist too: it is a scoping act, not a resolution.
- **Abandon the Map** — set `map.md`'s first line to `Status: abandoned`.
- **Reopen the Map** — set it to `Status: active`.

## Handoff

1. Read `map.md` and every ticket. If any ticket is `open`, or Not yet
   specified is not empty, list them and ask the human to confirm the Map
   has arrived anyway. Their judgment decides; nothing blocks it.
2. Read `../plan/SKILL.md` and follow its procedure **from step 2 (Spec)**,
   skipping the interview: the decisions are the Map. Before running
   `to-spec`, bring into the conversation the Destination, Decisions so far,
   and every resolved ticket's question and answer; that is what it
   synthesises from. The whole Map becomes **one** task set — never split it
   by area.
3. When the plan skill hands `to-tickets` the adapter doc, the set is
   **Map-sourced**: its "Map-sourced sets" section adds the Mint checkboxes.
   Mint nothing yourself.
4. Once the set derives READY:
   - make `Source map: <map-id>` the first line of the set's `spec.md`;
   - append `- <set-id>` to the Map's Spawned sets;
   - set `map.md`'s first line to `Status: arrived`, unless it already was
     (a further set from an arrived Map leaves the status alone).
5. Report the set id and the next step: `/cook:drain <set-id>`.

## List

Read every `.cook/maps/*/map.md` and each Map's ticket header lines. Print one
row per Map: id, Status, the Destination's first line, and the counts of open,
Frontier, and resolved tickets. Abandoned Maps last. Write nothing. No Maps:
say so, and how to chart one (`/cook:map <idea>`).

## The self-check

Every session that wrote to the Map ends here. Re-read the Map and fix each
fault before you stop:

- every `issues/` file is named `NN-<slug>.md`, and no two share a number;
- every ticket has `Type:` and `Status:` with an allowed value, and `Mode:`
  only on a `task` ticket;
- every `Blocked by:` number names an existing ticket, and no ticket blocks
  itself;
- every `resolved` ticket has an `## Answer` and a line in Decisions so far;
  every `out-of-scope` ticket an `## Answer` and a line in Out of scope; no
  `open` ticket appears in either;
- every file under `adrs/` and `context/` is linked from its ticket's answer;
- `map.md` starts with `Status: active`, `arrived`, or `abandoned`.

## Ground rules

- Every Map write goes through the cook-state read and mutation capability
  (your host's delivery note), one write per file per change. Read a file
  before you edit it. Never generate Map files with a script.
- Refer to tickets by their title in everything the human reads, with the
  number inside the link, never a bare number.
- Write nothing outside `.cook/maps/<map-id>/`, except the task set Handoff
  creates under `.cook/tasks/`. Commit nothing.

## Sources

`docs/spec/11-map.md` and `docs/adr/0017-cook-ports-wayfinding-as-cook-map.md`
in the cook repository; pop sources in their footers.
