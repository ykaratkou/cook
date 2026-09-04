---
status: accepted
date: 2026-09-04
---

# The companion skills ship with cook, vendored verbatim

`/cook:plan` is cook's entry verb and it was the one verb that failed on a
clean machine. It orchestrates three skills cook did not ship —
`grill-with-docs`, `to-spec`, `to-tickets` — which lived only in the author's
dotfiles. Anyone who ran `/plugin install cook@cook` or
`pi install git:github.com/ykaratkou/cook` got a broken first command, and the
best cook could do was detect the gap and print which skill to install by
hand. Doc 10's "Companion skills for `/cook:plan`" section named the
dependency; nothing closed it.

We decided **cook ships the companion skills**: verbatim copies of
[mattpocock/skills](https://github.com/mattpocock/skills) under `skills/`,
one directory per skill, discovered by both hosts exactly like cook's own
three. The dependency closure is five skills, not three —
`grill-with-docs` is a two-line skill that loads `grilling` and
`domain-modeling`, so those come too (`domain-modeling` with its
`CONTEXT-FORMAT.md` and `ADR-FORMAT.md`). Upstream is MIT, which is what
makes redistribution in a public marketplace plugin available at all; the
license gate is settled, not waived.

**Verbatim is the whole point.** The copies are not forked: `skills/PROVENANCE.md`
records the upstream repo, version, commit, and copy date, and the re-sync
procedure is a `diff` against a fresh clone. Cook adapts the skills from the
outside — `/cook:plan` hands `to-tickets` cook's issue-tracker adapter doc,
which is the same store-selection mechanism those skills already use, so
`/setup-matt-pocock-skills` (a command cook does not ship) never applies. A
local edit would turn every future re-sync into a merge, so the rule is: fix
`plan/SKILL.md` or the adapter doc, never the copy.

## Consequences

- Doc 10's companion-skills section inverts: the skills are cook's to deliver,
  and a machine without them is now a machine with a broken install, not a
  supported degraded mode. `/cook:plan` no longer opens by checking whether
  its companions exist, and the "stop and say which skill to install" branch
  is gone. Hand-authoring plus `/cook:register` survives as a fallback for
  humans who prefer it, not as the answer to a missing skill.
- `grilling` and `domain-modeling` ship model-invocable, as upstream ships
  them, so installing cook adds two skills the model may reach for outside
  `/cook:plan`. Accepted: silencing them would be an edit to a vendored file,
  and the verbatim rule is worth more than the narrower surface.
- Installing both cook and the `mattpocock-skills` plugin yields two copies of
  each of the five. Both hosts namespace skills by plugin, so they resolve;
  the duplication is cosmetic and is called out in `README.md` and
  `skills/PROVENANCE.md`.
- Cook now redistributes someone else's work, so attribution is a maintained
  artifact: `skills/LICENSE-mattpocock-skills` is upstream's license file
  verbatim, and the provenance record moves in the same commit as any re-sync.
- Keeping the copies current needs a clock, not a good intention, so a daily
  GitHub Action runs the re-sync and opens a pull request when upstream has
  moved (`.github/workflows/resync-vendored-skills.yml`). It merges nothing:
  this decision's review requirement is what makes the automation stop at a
  pull request. That is mechanism, not a further decision — no ADR of its own.

## Considered Options

- **Keep the dependency external and document the install.** Rejected: it was
  the state this ADR replaces. Every reader of the README had to install a
  second thing before cook's first verb worked, and the failure mode landed
  mid-interview rather than at install time.
- **Reimplement an interview, spec, and decomposition of our own.** Rejected:
  three skills of real depth would be reinvented worse, and cook's whole
  architecture (ADR-0003) is that markdown skills are the portable unit — the
  portable unit of *reuse*, not just of delivery.
- **Fork and adapt the copies** (drop the `/setup-matt-pocock-skills`
  references, disable model invocation, rewrite the tracker sections for
  `.cook/tasks/`). Rejected: adaptation is what the adapter doc already does
  from the outside, and a fork trades a `diff` for a merge on every upstream
  release.
- **Vendor by git submodule or `skills.sh` install step.** Rejected: a
  submodule breaks the plugin/pi install story (both hosts clone a plain
  repository and read files), and an install step is the external dependency
  under another name.

## Sources in pop

- Pop's planning path is pop's own code; the only piece cook ports is the
  issue-tracker adapter-doc mechanism (`integrate/issue-tracker.md`, pop
  `CONTEXT.md` **Issue tracker doc**), which is exactly the seam the vendored
  `to-tickets` is pointed at. Composing the rest of the plan verb from someone
  else's skills is cook's own decision, ledgered in `PARITY.md`'s
  marked-divergences table with a drift-guard item for the provenance record.
- Cook ADR-0003 (markdown skills are the portable core) — the reason a
  vendored skill directory is a first-class delivery unit on both hosts.
- Upstream: `mattpocock/skills` 1.2.3, MIT; the flow those skills define
  (grill → spec → tickets) is the one `/cook:plan` follows.
