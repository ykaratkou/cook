# Cook

Cook is an **in-agent plugin** that ports [pop]'s task-set *implement*
feature — the drain with its nested loops, the verification tail, the
remediation loop, the non-gating code review, and the human gates — into
agent hosts that share the markdown-skills standard. Claude Code and
[pi](https://github.com/earendil-works/pi) are the two supported hosts.

Cook is **docs-first**: the spec set under [`docs/spec/`](docs/spec/) is
implementation-binding. Start with
[`00-overview.md`](docs/spec/00-overview.md); the glossary is
[`CONTEXT.md`](CONTEXT.md), the porting ledger [`PARITY.md`](PARITY.md).

## Install

### Claude Code

```
/plugin marketplace add ykaratkou/cook
/plugin install cook@cook
```

(CLI equivalent: `claude plugin marketplace add ykaratkou/cook`, then
`claude plugin install cook@cook`.)

### pi

```sh
pi install git:github.com/ykaratkou/cook
```

Details, project-local installs, and the local-checkout dev setup:
[`pi/README.md`](pi/README.md).

### Companion skills for `/cook:plan`

`/cook:plan` orchestrates three skills cook depends on but does not ship —
`grill-with-docs`, `to-spec`, `to-tickets` — from Matt Pocock's
[skills for real engineers](https://github.com/mattpocock/skills). Pick one
route, not both; installing both leaves you with every skill twice.

Claude Code — the managed bundle, updated when upstream ships. It is in
Claude Code's official marketplace, so there is nothing to add first:

```sh
claude plugins install mattpocock-skills   # or /plugin install mattpocock-skills in-session
```

pi, or any host that reads `~/.agents/skills/` — editable copies you own.
The installer asks which skills to take; take at least `grill-with-docs`,
`to-spec`, and `to-tickets`:

```sh
npx skills@latest add mattpocock/skills
```

Cook needs no `/setup-matt-pocock-skills` run: it hands those skills its own
issue-tracker adapter doc, which points `to-tickets` at `.cook/tasks/` and
the register contract. Without the companion skills you lose `/cook:plan`
only — author sets by hand against the format contract and validate them with
`/cook:register`.

### Develop against a checkout

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
either. On pi the equivalent is `pi -e /path/to/cook` against an installed
`git:` package.

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
| `/cook:review <set-id>` | Force the Reviewer now, outside the automatic flow. |

`/cook:plan` is the one verb with an outside dependency — the companion
skills above. Every other verb works on a bare install.

All state lives in files under `.cook/` in the target repository — no
daemon, no database; a crashed or wandering drain is resumed by invoking
`/cook:drain` again.

[pop]: CONTEXT.md
