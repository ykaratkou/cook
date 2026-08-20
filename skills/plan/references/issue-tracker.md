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
  build`, `## Acceptance criteria` checkboxes), AFK/HITL typing rules — is
  the register skill's contract:
  `claude-code/skills/register/references/format-contract.md` (a verbatim
  copy of cook spec `docs/spec/01-storage.md`). It is authoritative; follow
  it for every file written.
- The planning spec is co-located as `spec.md` in the set directory
  (context only for cook's Verifier/Reviewer; the task files' acceptance
  criteria remain authoritative).

## Shape requirements

- AFK tasks: small vertical slices, each doable by a fresh-context agent
  without asking, each with at least one acceptance checkbox.
- HITL tasks: **only human work** (verification, decisions, sign-off);
  agent-doable prep belongs in a separate AFK task the HITL task is
  `blocked_by`. Canonical shape: a single terminal HITL sign-off task,
  blocked by every AFK task in the set.
- Publishing here is *drafting*: the set counts as registered only when
  `/cook:register` (or plan's self-validation) derives READY.

## Sources

`docs/spec/01-storage.md` and `docs/spec/10-hosts.md` in the cook repository
(pop sources in their footers; the adapter-doc mechanism is pop's
`integrate/issue-tracker.md`).
