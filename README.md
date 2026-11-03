# Cook

Cook is an **in-agent plugin** that ports [pop]'s task-set *implement*
feature — the drain with its nested loops, the verification tail, the
remediation loop, the Refine pass, and the human gates — into agent hosts
that share the markdown-skills standard. Claude Code,
[opencode](https://opencode.ai) 2.x, and Codex are supported hosts.

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
supported; the adapter SDK is pinned to v2.2.5). opencode has no marketplace, so it
installs straight from the GitHub repo:

```sh
opencode plugin add github:ykaratkou/cook
```

That installs the plugin with its dependencies and adds it to the global
`~/.config/opencode/opencode.json`. Restart opencode; `/cook:status` should
autocomplete. The verbs are spelled exactly as on Claude Code (`/cook:drain`,
`/cook:plan`, …).

Updating is covered in [Updating on opencode](#updating-on-opencode) below.

Commands show a compact `/cook:<verb> <arguments>` message. The expanded prompt
and runtime paths are stored as the session instruction entry
`cook/active-command`, retained for follow-up turns and replaced by the next Cook
command in that session. This requires opencode v2.2.5 or newer. Do not queue
different Cook commands in the same session before the previous one has run:
they share that active instruction entry.

To check the adapter against your installed opencode (plugin load, the seven
commands and twelve skills, a `subagent` round-trip, a dismissed headless
`question`, a git-spec install of the committed `HEAD`), run the smoke script
from a checkout:

```sh
opencode/smoke-test.sh                # expects `SMOKE OK`; spends a few model calls
```

It runs a private `opencode serve` against a throwaway config dir and never
writes `~/.config/opencode`. `OPENCODE_BIN` overrides the binary and
`COOK_SMOKE_MODEL` (`provider/model`) the model.

### Codex

Cook ships a native Codex plugin, checked against Codex CLI 0.166.0:

```sh
codex plugin marketplace add ykaratkou/cook
codex plugin add cook@cook
```

Restart Codex, then select a skill with `$` or `/skills`. The seven entry
points are `$cook:plan`, `$cook:drain`, `$cook:register`, `$cook:status`,
`$cook:verify`, `$cook:refine`, and `$cook:map`. For example:

```text
$cook:plan Add email notifications
$cook:drain email-notifications
```

Where this README or a shared skill says `/cook:<verb>`, use `$cook:<verb>`
on Codex. All seven skills require explicit invocation. Companions load by
path from the plugin's shared files, without a separate installation.
Cook needs Codex's subagent tools for attempts, verification, and Refine.
When a structured question tool is unavailable, gates present their choices
in chat and wait for your reply; non-interactive execution parks at a gate.

To update, run `codex plugin marketplace upgrade cook`, then
`codex plugin add cook@cook` and restart Codex. To remove it, run
`codex plugin remove cook@cook`.

For a local checkout, replace the marketplace-add argument with its absolute
path. Reinstall after changes: Codex runs a cached copy, not the working tree.
`node codex/smoke-test.mjs` checks installation and skill discovery in a
temporary `CODEX_HOME`, including bundled references and invocation policies.
It makes no model calls and does not change your Codex configuration.

### Companion skills — already included

`/cook:plan` runs an interview → spec → tickets flow it did not invent: the
`grill-with-docs`, `grilling`, `domain-modeling`, `to-spec`, and `to-tickets`
skills from Matt Pocock's [skills for real engineers](https://github.com/mattpocock/skills)
(MIT). Cook **ships verbatim copies** of all five under `skills/`, so there is
nothing to install and no `/setup-matt-pocock-skills` to run — cook hands them
its own issue-tracker adapter doc, pointing the decomposition at `.cook/tasks/`.

The interview runs `grilling` under cook's own rules rather than
`grill-with-docs`: the ADRs and glossary changes it settles are written as
drafts inside the task set (`.cook/tasks/<set-id>/adrs/`, `context/`), not
into your repository. The task that implements each decision **Mints** its
draft — a numbered ADR, a glossary edit — in the same commit as the code.
So a plan leaves your working tree untouched, and two plans can run in one
repository at once ([ADR-0018](docs/adr/0018-plan-drafts-decisions-into-the-set.md)).

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

### Updating on opencode

There is no version to bump here either: opencode tracks an unpinned git
plugin by commit. It checks for newer commits when it starts, but does not
install them on its own. By hand:

```sh
opencode plugin list                          # the cook row's VERSION is the installed commit
opencode plugin check github:ykaratkou/cook   # is a newer commit available?
opencode plugin update github:ykaratkou/cook  # install it; restart opencode to apply
```

`opencode plugin update` with no target updates every outdated plugin.

To stay on one commit, install a pinned spec instead,
`github:ykaratkou/cook#<full-sha>`: `plugin update` skips pinned specs. To
uninstall, run `opencode plugin remove github:ykaratkou/cook`.

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
| `/cook:plan <feature>` | Author a task set: grill (decisions drafted in the set) → spec → tickets → self-validated READY. |
| `/cook:drain [set-id]` | The drain. No argument picks the highest-priority READY set. |
| `/cook:register <set-id>` | Validate a hand-authored or hand-edited set; fix list or READY. |
| `/cook:status` | Derive and print every set's status and open tasks. Read-only. |
| `/cook:verify <set-id>` | Force the Verifier now, outside the automatic flow. |
| `/cook:refine <set-id>` | Force a Refine pass now, outside the automatic flow. |

Work too big for one session starts one step earlier, with **Wayfinding**:
`/cook:map <idea>` charts a Map of decision tickets, `/cook:map <map-id>`
resolves them a session at a time (agent-only tickets in parallel
subagents), and `/cook:map <map-id> handoff` turns the finished Map into one
task set for `/cook:drain`. Bare `/cook:map` lists your Maps; `<map-id> assist`
reshapes one without deciding anything.

Every verb works on a bare install: the skills `/cook:plan` and `/cook:map`
orchestrate ship with cook (see above).

All state lives in files under `.cook/` in the target repository — no
daemon, no database; a crashed or wandering drain is resumed by invoking
`/cook:drain` again.

[pop]: https://github.com/glebglazov/pop
