---
status: accepted
date: 2026-11-05
---

# Cook ships auto-grill

`auto-grill` answers a grilling round for the human. It hands the round's open
questions to a read-only answerer subagent, which is instructed by
`ANSWERER.md`. It applies the answers the code, glossary, ADRs or web support,
and leaves judgement calls open for the human. ADR-0019 already names it as the
delegate a driven `/cook:plan` uses at a `questions` stop, and
`decision-drafts.md` already says how its answers land: as the human's, with
judgement calls left open and everything written only as drafts. The skill
itself lived in the author's dotfiles, so cook's documented flow depended on a
skill that cook did not ship.

We decided **cook ships `auto-grill` as one of its own skills**, at
`skills/auto-grill/` (user decision, 2026-11-05: "move auto-grill skill from
~/.dotfiles to this repo").

- It is cook's own text, not a vendored companion. Cook can edit it, and
  `PROVENANCE.md`'s verbatim rule does not apply to it.
- It is explicit-only on every host: `/cook:auto-grill` on Claude Code
  (`disable-model-invocation: true`, user-invocable, with no command beside
  it), `cook/auto-grill` with autoinvoke off on opencode, and the
  `$cook:auto-grill` wrapper with `allow_implicit_invocation: false` on Codex.
- Its eval runner (`evals/run.py`) moves with it, because the runner reads
  `ANSWERER.md` from its parent directory. Eval results stay untracked.
- The run log stays outside every repository, under
  `~/.local/state/auto-grill/runs/`.
- `auto-grill-improve` stays in the author's dotfiles, pointed at a cook
  checkout. It edits `ANSWERER.md` in a source tree, so it is a maintainer
  tool, not a plugin verb.

## Consequences

- Inside `/cook:plan` or a Map grilling ticket, `auto-grill`'s "update
  GLOSSARY.md" step is overridden from the outside by `decision-drafts.md`:
  the glossary change goes to the Context draft. The skill text needs no
  cook-specific branch.
- opencode registers thirteen skills, and the Codex plugin has eight entry
  skills. The smoke tests check both counts.

## Sources

- Cook ADR-0010 (vendored companions), ADR-0018 (decision drafts), ADR-0019
  (Cook-Stop lines and delegated answers); doc 10.
