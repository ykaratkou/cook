# 10 — Hosts

Cook's portable core is a markdown skill set (the agentskills standard);
everything host-specific is an adapter declared here. Claude Code is the one
supported host (ADR-0012). The declaration pattern is ported from pop's
adapter capabilities: a host declares each capability **Supported** (cook may
rely on it, with the named mechanism), **Blind** (cook must not rely on it;
the spec'd behavior stays dormant until a host can enforce it), or
**Human-facing** (the capability's audience is the human; no cook logic may
rely on it). A Blind declaration carries the reason, so a human can see what
the host would need. A Human-facing declaration has no reason to carry:
nothing depending on it is the design, not a gap (ADR-0009).

## Capability matrix

| Capability | claude-code |
|---|---|
| Markdown skills (agentskills standard) | **Supported** — `.claude/skills/`, plugin skills |
| Slash command mapping | **Supported** — plugin commands, always namespaced: `/cook:drain`, `/cook:plan`, … |
| Fresh-context subagent spawn | **Supported** — built-in Agent tool |
| Subagent output capture | **Supported** — the subagent's final message is the Agent tool's return value |
| Structured mid-session ask (gates) | **Supported** — AskUserQuestion |
| Turn cap enforcement | **Blind** — the Agent tool exposes no per-spawn turn bound |
| Timeout kill | **Blind** — no way to bound or kill a running subagent |
| Loop-hardening hook (optional) | **Human-facing** — a stop hook re-injects "continue the drain" when the orchestrator ends its turn with the set non-terminal; scoped to the orchestrator session by matching the lock's `session` token against the stopping session's own transcript (the orchestrator typed it), silent in every other session |
| Interrupt detection | **Supported** — the human's Esc interrupts the running tool; the orchestrator observes the cancelled spawn |
| Cook-state read and mutation | **Supported** — the `Read`, `Edit`, and `Write` tools. `Edit` requires the file to have been read first in the session (the stale-read guard ground rule 1 asks for). Writes are **in place**: no rename-over-target primitive is offered |
| RFC3339 UTC timestamps | **Supported** — `date -u +%Y-%m-%dT%H:%M:%SZ` through the Bash tool |
| Subagent trace visibility | **Human-facing** — host-native: `/tasks` lists running and finished subagents and opens any one's transcript, the subagent panel shows live status, and each subagent's transcript persists at `~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl` |

The host's file tools perform no rename-over-target — they write in place.
That is why the portable core states the **guarantee** (one write per
transition; facts that must land together land in one write) rather than a
mechanism: the guarantee is holdable, the temp-file-and-rename recipe is not
(ADR-0008).

Both Blind rows follow pop's rule: cook never emits a bound it cannot
recognize, and the spec keeps the behavior (turn-cap exhaustion outcome, the
resume lesson) defined so a Supported host slots in without a spec change.

The two **Human-facing** rows are the opposite case: no cook behavior waits on
them, so there is nothing to keep dormant and nothing for a future host to
unlock. They are in the matrix because a human asks about them, not because
cook does (ADR-0009).

## Loop hardening is optional, correctness is not

The hooks in the matrix's hardening row protect against one failure mode only:
the orchestrator model ending its turn while the drain is mid-flight.
Correctness never depends on them — all state lives in files (doc 01), so
re-invoking `/cook:drain` re-derives everything and resumes exactly where the drain
stopped. A host with no hook support runs cook correctly; the human just
occasionally types `/cook:drain` again.

## Per-host layout

```
cook/
├── prompts/            ← shared, single copy (doc 09's files)
├── PROVENANCE.md       ← the vendored companion skills' upstream record
├── LICENSE-mattpocock-skills  ← their upstream license, verbatim
├── skills/             ← shared, single copy: the drain orchestration skill
│                         + authoring contract (agentskills standard), plus
│                         the five vendored companion skills (ADR-0010).
├── docs/               ← this spec set
├── claude-code/        ← the Claude Code plugin
│   ├── commands/       ← /cook:drain, /cook:plan, /cook:register,
│   │                     /cook:status, /cook:verify, /cook:review
│   ├── skills/         → symlink to ../skills
│   └── hooks/          ← optional stop-hook hardening
```

The prompts and skills directories live at the repo root, outside the
host adapter: a pop prompt port lands once, and the plugin reaches the one
`skills/` copy through a relative symlink. Only the command wiring and the
hooks are host-specific.

### claude-code specifics

- Attempts, Verifier, Reviewer: Agent tool spawns with the rendered prompt as
  the task text; the return value is parsed for sentinels / VERDICT / the
  review document.
- Gates: AskUserQuestion with the gate's allowed outcomes (doc 08).
- The plugin's drain skill is the orchestrator instruction set; the
  `/cook:drain` command invokes it.
- The **plugin root is the repo root** (`.claude-plugin/plugin.json` at the
  top, pointing `commands` and `hooks` into `claude-code/`): plugin paths
  cannot reach outside the plugin root after installation, and rooting at
  the repo keeps `prompts/` a single shared copy
  (`${CLAUDE_PLUGIN_ROOT}/prompts`). Plugin commands are always namespaced
  (`/cook:plan`) — a plugin cannot claim a bare name, and bare names do not
  resolve to plugin commands. A bare `/cook` is therefore unavailable on this
  host, which is why the drain verb is spec'd as `/cook:drain`
  (`commands/drain.md`), accepted as the surface (user decision,
  2026-08-20). A personal command at `~/.claude/commands/cook.md`
  loading the drain skill would restore a bare verb if ever wanted.
- **Skill registration is the plugin root's `skills/` directory**, and cook
  cannot opt out of it: Claude Code scans a plugin's default `skills/` path
  and registers every `<dir>/SKILL.md` it finds as `cook:<dir>` (verified
  against Claude Code 2.1.260). Cook's own three are registered there like
  everything else and are muzzled in **frontmatter** instead —
  `user-invocable: false` (commands and skills share one namespace, so a
  surfaced `plan`/`register` skill would collide with the command of that
  name) and `disable-model-invocation: true` (the drain/plan/register
  instruction sets must never fire on the model's own initiative). The
  commands load them by path, through the `claude-code/skills/` relative
  symlink; the files keep the agentskills SKILL.md shape as the portable core
  (ADR-0003).
- The five vendored companion skills sit in that same directory and are
  registered the same way, as `cook:grill-with-docs`, `cook:grilling`,
  `cook:domain-modeling`, `cook:to-spec`, `cook:to-tickets`. They keep
  upstream's frontmatter, so — unlike cook's own three — they are meant to be
  invoked, which is what makes `/cook:plan` work on a bare install
  (ADR-0010).
- The delivery note mapping each capability the skills name to its
  mechanism (ADR-0006) is `skills/drain/references/host-claude-code.md`.

## Companion skills for `/cook:plan`

`/cook:plan` (doc 03's front door) orchestrates skills cook did not author but
**does ship**: `grill-with-docs` (interview; ADRs + glossary), `to-spec` (the
spec document), and `to-tickets` (decomposition into the task set), plus the
two `grill-with-docs` itself loads — `grilling` and `domain-modeling`. They are
verbatim copies of [mattpocock/skills](https://github.com/mattpocock/skills)
(MIT), vendored under `skills/` as one directory per skill, so the host
discovers them exactly as it discovers cook's own three (ADR-0010).

- The copies are **not forked**. `PROVENANCE.md` (repo root) is the record —
  upstream repo, version, commit, copy date, what was excluded, and the
  re-sync procedure (a `diff` against a fresh clone). An adaptation cook wants
  goes in `skills/plan/SKILL.md` or the adapter doc below, never in a copy.
- Cook ships an **issue-tracker adapter doc** (the mechanism those skills
  already use to pick a store): it names cook's store — `.cook/tasks/` in the
  target repo — and the register contract, so `to-tickets` publishes cook-shaped
  sets. It is also what makes the vendored copies' `/setup-matt-pocock-skills`
  references inapplicable: the tracker is always already configured.
- `/cook:plan` therefore assumes its companions are present, and does not open
  by checking. A host that cannot see them is a broken install, not a degraded
  mode. Authoring sets by hand (or with any other agent) against doc 01's
  contract and validating with `/cook:register` remains available to a human
  who prefers it.

## Sources in pop

- `CONTEXT.md` — **Agent adapter** / adapter-capability entries (the
  Supported/Blind declaration pattern; the third value, **Human-facing**, is
  cook's own addition — ADR-0009, ledgered as a divergence), **Agent preset**
- `docs/adr/0165`, `docs/adr/0166` (capability declaration seams),
  `docs/adr/0190` (turn cap: only the enforcer emits the bound; Blind
  declarations name their reason)
- `integrate/issue-tracker.md` and `CONTEXT.md` **Issue tracker doc** — the
  adapter-doc mechanism `/cook:plan` reuses
- Claude Code facts from the
  plugin/skill/Agent-tool surface in current Claude Code, its `/tasks` view,
  and its per-session `subagents/*.jsonl` transcripts
