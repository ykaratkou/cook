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

Cook's opencode adapter is one opencode **v2** plugin (opencode 1.x is not
supported; facts are pinned to v2.0.20). opencode has no marketplace, so it
installs straight from the GitHub repo:

```sh
opencode plugin add github:ykaratkou/cook
```

That installs the plugin with its dependencies and adds it to the global
`~/.config/opencode/opencode.json`. Restart opencode; `/cook:status` should
autocomplete. The verbs are spelled exactly as on Claude Code (`/cook:drain`,
`/cook:plan`, …).

opencode checks an unpinned git plugin for newer commits when it starts, but
does not install them on its own. `opencode plugin update` installs them;
restart opencode afterwards. Pin a commit with
`github:ykaratkou/cook#<full-sha>` (`plugin update` skips pinned specs).

To check the adapter against your installed opencode (plugin load, the six
commands and eight skills, a `subagent` round-trip, a dismissed headless
`question`, a git-spec install of the committed `HEAD`), run the smoke script
from a checkout:

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

### Updating on Claude Code

`.claude-plugin/plugin.json` carries no `version`, so the published version
is derived from the commit: every pushed commit is a new version, with no
bump or release step. Claude Code does not auto-update a marketplace you
added yourself unless you turn it on, in `/plugin` → Marketplaces, or with
`"autoUpdate": true` on the marketplace's `extraKnownMarketplaces` entry in
`~/.claude/settings.json`. Then each session start picks up the newest
commit. By hand:

```sh
claude plugin marketplace update cook
claude plugin update cook@cook        # restart Claude Code to apply
```

### Develop against a checkout

On opencode, point the `plugins` array at your checkout's `opencode/`
directory instead of the git spec, after installing the dependencies at the
checkout root (opencode installs none for a checkout-path plugin):

```sh
git clone https://github.com/ykaratkou/cook.git ~/src/cook
(cd ~/src/cook && npm ci)
```

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [{ "package": "/Users/you/src/cook/opencode" }]
}
```

opencode then runs your working tree; restart it to pick up edits. On Claude
Code, run a working tree instead of the published copy with:

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
