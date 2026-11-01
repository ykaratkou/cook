# Decision drafts

The rules for a grilling interview that writes nothing into the repository.
`/cook:plan`'s interview follows them, and so does a `/cook:map` grilling
ticket. A decision the interview settles is written as a **draft** under
`.cook/`, and the task that implements it later **Mints** it into the
repository, in the same commit as the change it describes. Spec:
`docs/spec/01-storage.md` ("Decision drafts") in the cook repository;
ADR-0018.

The caller names two things:

| | `/cook:plan` | `/cook:map` grilling ticket |
| --- | --- | --- |
| **Drafts folder** | `.cook/tasks/<set-id>/` | `.cook/maps/<map-id>/` |
| **Draft name** | ADR: a slug of the ADR's title. Context: `<set-id>` | `NN-<slug>`, the ticket's file name |

## The interview

Read cook's `grilling` skill (`../../grilling/SKILL.md`) and run its
interview. Never load `domain-modeling` or `grill-with-docs`: both write into
the repository. Instead, keep their discipline yourself:

- **Read the repository's glossary** (`GLOSSARY.md`, or `CONTEXT.md` where
  that is the file; in a multi-context repo, the map file and the context
  the work touches) before the first round, and **challenge** every term the
  human uses that conflicts with it.
- **Sharpen fuzzy language**: when a term is vague or overloaded, propose a
  precise canonical one.
- **Stress-test with concrete scenarios** that probe the edges between
  concepts.
- **Cross-reference with the code**: when the human states how something
  works and the code disagrees, say so.

The human answers for themselves; never answer your own questions.

## Context draft

At the close of each round that settled terms, write them to
`<drafts folder>/context/<draft name>.md`. One file per interview (or per
ticket), continued in place. It names the glossary file it changes, then
holds, in the glossary's own format (`../../domain-modeling/GLOSSARY-FORMAT.md`):

- `## Add`: new entries, with the section each goes into;
- `## Replace`: an existing entry, or one line of it, and its new text;
- `## Remove`: entries or sections to delete;
- optionally `## Not terms`: words settled as *not* glossary entries, so a
  later session does not re-ask.

A context draft is an edit to apply, not a copy of the glossary. It holds no
implementation detail: the glossary is a glossary and nothing else.

## ADR draft

Offer an ADR only when all three hold: **hard to reverse**, **surprising
without context**, and **the result of a real trade-off**. When the human
agrees, write it in full to `<drafts folder>/adrs/<draft name>.md`, in the
structure of `../../domain-modeling/ADR-FORMAT.md`, ignoring that file's
location and numbering rules. It carries **no number**, and nothing cites
one for it: the number is picked when it is Minted. Refer to it by its draft
path until then.

## Discipline

- **Resume, never fork.** Before the first round, read every draft already
  in the drafts folder for this interview (or ticket). A prior session may
  have died mid-interview. Continue each file in place; never start a second
  draft beside one.
- **Write only drafts.** No glossary edit, no `docs/adr/` file, no code
  change, and no commit, at any point. If you reach for `git add`, stop.
- Every draft write goes through the cook-state read and mutation capability
  (your host's delivery note), one write per file per change.

## Mint

A draft reaches the repository only through the task that implements the
decision it records, as checkboxes under that task's
`## Acceptance criteria`, with the draft path written out in full:

- `- [ ] docs/adr/NNNN-<slug>.md created from <drafts folder>/adrs/<draft name>.md (next free ADR number)`
- `- [ ] <drafts folder>/context/<draft name>.md applied to the glossary`

The implementer picks the ADR number when it Mints (the highest in
`docs/adr/` plus one), and applies a context draft against the glossary as
it then stands: if the glossary changed since the draft, it reconciles the
edit with the current text rather than overwriting it. Each draft is Minted
by exactly one task. Writing the tasks mints nothing; the adapter doc
(`issue-tracker.md`, "Mint checkboxes") says how the checkboxes are placed.
