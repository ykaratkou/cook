# Cook

Cook is an **in-agent plugin** that ports [pop]'s task-set *implement*
feature — the drain with its nested loops, the verification tail, the
remediation loop, the Refine pass, and the human gates — into agent hosts
that share the markdown-skills standard. Claude Code and
[opencode](https://opencode.ai) 2.x are the two supported hosts.

The original is [glebglazov/pop](https://github.com/glebglazov/pop) — an
external orchestrator: a standalone binary that spawns agent CLIs as headless
subprocesses and owns all state. Cook keeps its vocabulary and its flow, and
drops the external process: the orchestrator is the human's own agent
session, and files under `.cook/` are the only state.

Cook is **docs-first**: the spec set under [`docs/spec/`](docs/spec/) is
implementation-binding. Start with
[`00-overview.md`](docs/spec/00-overview.md); the glossary is
[`CONTEXT.md`](CONTEXT.md) (pop's terms, imported verbatim), the porting
ledger [`PARITY.md`](PARITY.md).

## Install

### Claude Code

```
/plugin marketplace add ykaratkou/cook
/plugin install cook@cook
```

(CLI equivalent: `claude plugin marketplace add ykaratkou/cook`, then
`claude plugin install cook@cook`.)

### opencode

Cook's opencode adapter is one opencode **v2** plugin in `opencode/` (opencode
1.x is not supported; facts are pinned to v2.0.20). Install it by pointing
opencode's `plugins` array at a cook checkout — installing and developing are
the same step:

```sh
git clone https://github.com/ykaratkou/cook.git ~/src/cook
(cd ~/src/cook/opencode && npm ci)    # opencode installs no dependencies for a checkout-path plugin
```

Then add the adapter directory to `~/.config/opencode/opencode.json` (or a
project's `opencode.json`), using the absolute path of your checkout:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [{ "package": "/Users/you/src/cook/opencode" }]
}
```

Restart opencode; `/cook:status` should autocomplete. The verbs are spelled
exactly as on Claude Code (`/cook:drain`, `/cook:plan`, …), and `git pull` in
the checkout is the update.

A git-spec install without a checkout (`opencode plugin add` with a
`#path:opencode` subpath) is **not supported yet**: opencode 2.0.20 installs
only the `opencode/` subfolder, so the plugin cannot reach the repo-root
`skills/`, `prompts/`, and `conventions/` it serves. Follow-up: revisit when
opencode keeps the repo root reachable (the smoke script below reports this
finding on every run).

To check the adapter against your installed opencode (plugin load, the six
commands and eight skills, a `subagent` round-trip, a dismissed headless
`question`), run the smoke script from the checkout:

```sh
opencode/smoke-test.sh                # expects `SMOKE OK`; spends a few model calls
```

It runs a private `opencode serve` against a throwaway config dir and never
writes `~/.config/opencode`. `OPENCODE_BIN` overrides the binary and
`COOK_SMOKE_MODEL` (`provider/model`) the model.

### Companion skills — already included

`/cook:plan` runs an interview → spec → tickets flow it did not invent: the
`grill-with-docs`, `grilling`, `domain-modeling`, `to-spec`, and `to-tickets`
skills from Matt Pocock's [skills for real engineers](https://github.com/mattpocock/skills)
(MIT). Cook **ships verbatim copies** of all five under `skills/`, so there is
nothing to install and no `/setup-matt-pocock-skills` to run — cook hands them
its own issue-tracker adapter doc, pointing the decomposition at `.cook/tasks/`.

Provenance, the verbatim rule, and the upstream re-sync procedure:
[`PROVENANCE.md`](PROVENANCE.md) (the decision is
[ADR-0010](docs/adr/0010-companion-skills-ship-with-cook.md)). If you already
have these skills, nothing collides: Claude Code loads cook's copies under a
`cook:` prefix and opencode under a `cook/` prefix, beside your own.

### Develop against a checkout

On opencode the install above already runs your checkout. On Claude Code,
`.claude-plugin/plugin.json` carries no `version`, so the published version
is derived from the commit — installed copies pick up each pushed commit on
the next session start (no bump, no release step). To run a working tree
instead of the published copy:

```sh
claude --plugin-dir /path/to/cook     # this checkout, shadowing the installed copy
claude                                # the published GitHub copy
```

The `--plugin-dir` copy takes precedence for that session only, so you can
flip between your edits and the published plugin without uninstalling
either.

## Use

One feature, one flow — the human touches it at plan, at gates, and at
sign-off; everything between is automatic:

| Command | What it does |
| --- | --- |
| `/cook:plan <feature>` | Author a task set: grill → spec → tickets → self-validated READY. |
| `/cook:drain [set-id]` | The drain. No argument picks the highest-priority READY set. |
| `/cook:register <set-id>` | Validate a hand-authored or hand-edited set; fix list or READY. |
| `/cook:status` | Derive and print every set's status and open tasks. Read-only. |
| `/cook:verify <set-id>` | Force the Verifier now, outside the automatic flow. |
| `/cook:refine <set-id>` | Force a Refine pass now, outside the automatic flow. |

Every verb works on a bare install: the skills `/cook:plan` orchestrates
ship with cook (see above).

All state lives in files under `.cook/` in the target repository — no
daemon, no database; a crashed or wandering drain is resumed by invoking
`/cook:drain` again.

[pop]: https://github.com/glebglazov/pop
