---
status: accepted
date: 2026-08-20
---

# Pi commands are extension-registered and namespaced

The spec's pi row said "Commands: prompt templates named for the cook verbs."
Implementing against pi v0.84.2 surfaced a fragility: cook's drain/plan/
register skills are hidden from the model (`disable-model-invocation`), so a
prompt template must point at the skill **by file path** — and the path
varies per machine and install method. A baked path is exactly the kind of
silent breakage cook's re-derive-everything posture forbids.

We decided the cook pi extension registers the commands itself via
`pi.registerCommand`: the extension resolves its own location
(`import.meta`), reads the sibling skill files, and injects the skill text
plus arguments as the user message. No path is ever baked into shipped text.

The surface is the **same namespaced verb set as the claude-code plugin**:
`/cook:drain`, `/cook:plan`, `/cook:register`, `/cook:status`,
`/cook:verify`, `/cook:review`. Pi could register a bare `/cook`, but
claude-code cannot (plugins cannot claim bare names), and one surface that
reads identically in both hosts' docs beats a per-host alias (user decision,
2026-08-20). Colon names are verified empirically (pi's own `/skill:name`
registry uses them); hyphens are the recorded fallback.

Consequence: `docs/spec/10-hosts.md`'s slash-command row and pi specifics,
and ADR-0003's "`/cook` resolves unnamespaced on both hosts" sentence, are
superseded on this point.

## Considered Options

- **Prompt templates (as spec'd).** Rejected: filename-named templates work,
  but their bodies need the skill path; install-path variance makes every
  install a template edit.
- **Bare `/cook` on pi only.** Rejected: an asymmetric surface forks the
  docs and the muscle memory for no capability gain.

## Sources in pop

- Pi facts: `docs/extensions.md` (`registerCommand`, `sendUserMessage`),
  `docs/prompt-templates.md`, `docs/skills.md` (`disable-model-invocation`,
  `/skill:name`) in pi-coding-agent v0.84.2.
- Cook ADR-0003 (portable core), ADR-0006 (delivery notes); the claude-code
  `/cook:drain` decision in `docs/spec/10-hosts.md`.
