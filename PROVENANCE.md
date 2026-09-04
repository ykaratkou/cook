# Provenance: the vendored companion skills

Five of the skill directories under `skills/` were **not written for cook**.
They are verbatim copies of Matt Pocock's skills, vendored so `/cook:plan`
works on a bare install (see
[ADR-0010](docs/adr/0010-companion-skills-ship-with-cook.md)).

This record lives at the repo root, not in `skills/`, because pi loads every
root-level `.md` file of a package's skills directory as a skill and rejects
this one for having no `description`.

| Vendored skill | Why cook needs it |
| --- | --- |
| `grill-with-docs/` | `/cook:plan` step 1 — the design interview. |
| `grilling/` | Loaded by `grill-with-docs`. |
| `domain-modeling/` | Loaded by `grill-with-docs` (with `CONTEXT-FORMAT.md`, `ADR-FORMAT.md`). |
| `to-spec/` | `/cook:plan` step 2 — the spec document. |
| `to-tickets/` | `/cook:plan` step 3 — decomposition into the task set. |

Everything else under `skills/` is cook's own (`drain/`, `plan/`,
`register/`).

## Upstream

- **Repository**: <https://github.com/mattpocock/skills>
- **License**: MIT — [`LICENSE-mattpocock-skills`](LICENSE-mattpocock-skills)
  beside this file is the upstream license file, copied verbatim
  (Copyright (c) 2026 Matt Pocock).
- **Copied from**: tag/version `1.2.3`, commit
  `3cca18b368ae95cdbdebbff572ccafa662551015`
- **Copy date**: 2026-09-04
- **Upstream paths**: `skills/engineering/{grill-with-docs,domain-modeling,to-spec,to-tickets}`,
  `skills/productivity/grilling` — flattened to one directory per skill here,
  because both hosts discover skills as `skills/<name>/SKILL.md`.
- **Excluded**: each upstream skill's `agents/openai.yaml` (display metadata
  for the `skills.sh` installer, which cook does not use). Nothing else was
  dropped.

## The verbatim rule

**Do not edit the vendored files.** They are copies, and a local edit turns
the re-sync below from a `diff` into a merge. Cook adapts them from the
outside instead:

- `to-tickets` (and `to-spec`) expect an issue tracker configured by
  `/setup-matt-pocock-skills`, a command cook does not ship. It never
  applies: `/cook:plan` hands them
  [`skills/plan/references/issue-tracker.md`](skills/plan/references/issue-tracker.md),
  cook's adapter doc, which names `.cook/tasks/` as the store and the
  register contract as the file format.
- `grilling` and `domain-modeling` ship as upstream ships them, model-invocable
  (no `disable-model-invocation`), so installing cook makes those two
  available to the model in any session — not just under `/cook:plan`. That is
  upstream's design, kept deliberately.

## When the machine already has these skills

The two hosts resolve a duplicate name differently, and neither breaks:

- **Claude Code** namespaces plugin skills, so cook's copies load as
  `cook:grilling`, `cook:to-spec`, and so on. Someone who also installs the
  upstream `mattpocock-skills` plugin sees both sets, under their own
  prefixes.
- **pi** has one flat skill namespace with a location precedence, and keeps
  the *first* skill found: a copy in `~/.agents/skills/` (or `.agents/skills/`
  in the project) wins, and cook's package copy is skipped with a
  `[Skill conflicts]` warning at startup. This is the intended outcome — the
  human's own copy of an upstream skill takes precedence over cook's vendored
  one, and `/cook:plan` runs against whichever won, because both are the same
  upstream skill.

Cook does **not** rename the vendored directories to dodge those warnings:
the name is how `grill-with-docs` reaches `grilling` and `domain-modeling`
(it calls them by name, in a file the verbatim rule forbids editing), and
being shadowed by the human's own copy is the behavior we want, not a
collision to design around.

## Re-syncing with upstream

A GitHub Action runs this every morning
(`.github/workflows/resync-vendored-skills.yml`, calling
`.github/scripts/resync-vendored-skills.sh`): when the copies no longer match
upstream it opens one pull request carrying the diff, the upstream commit list,
and a review checklist. Nothing lands on the default branch automatically —
cook redistributes this text, so a human reads the diff. To do it by hand:

```sh
git clone --depth 1 https://github.com/mattpocock/skills.git /tmp/mp-skills
for pair in \
  engineering/grill-with-docs:grill-with-docs \
  productivity/grilling:grilling \
  engineering/domain-modeling:domain-modeling \
  engineering/to-spec:to-spec \
  engineering/to-tickets:to-tickets
do
  diff -ru --exclude=agents \
    "/tmp/mp-skills/skills/${pair%%:*}/" "skills/${pair##*:}/"
done
```

Empty output means the copies are current. Otherwise take the upstream side
wholesale (`rsync -a --exclude agents`), re-read what changed, and update the
commit, version, and date above in the same commit — or just run the script,
which does exactly that. If an upstream change
breaks `/cook:plan`'s procedure, the fix belongs in
[`plan/SKILL.md`](plan/SKILL.md) or the adapter doc — never in the copy.
