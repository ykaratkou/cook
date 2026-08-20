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

`/cook:plan` additionally needs the companion skills `grill-with-docs`,
`to-spec`, and `to-tickets` in `~/.agents/skills/` (both hosts read it);
without them, author sets by hand against the format contract and validate
with `/cook:register`.

All state lives in files under `.cook/` in the target repository — no
daemon, no database; a crashed or wandering drain is resumed by invoking
`/cook:drain` again.

[pop]: CONTEXT.md
