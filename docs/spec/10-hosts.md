# 10 — Hosts

Cook's portable core is a markdown skill set (the agentskills standard);
everything host-specific is an adapter declared here. Claude Code and
opencode 2.x are the two supported hosts (ADR-0014; every opencode fact is
pinned to v2.0.20, and opencode 1.x is not supported). The declaration pattern is ported from pop's
adapter capabilities: a host declares each capability **Supported** (cook may
rely on it, with the named mechanism), **Blind** (cook must not rely on it;
the spec'd behavior stays dormant until a host can enforce it), or
**Human-facing** (the capability's audience is the human; no cook logic may
rely on it). A Blind declaration carries the reason, so a human can see what
the host would need. A Human-facing declaration has no reason to carry:
nothing depending on it is the design, not a gap (ADR-0009).

## Capability matrix

| Capability | claude-code | opencode (2.0.20) |
|---|---|---|
| Markdown skills (agentskills standard) | **Supported** — `.claude/skills/`, plugin skills | **Supported** — the plugin registers each root `skills/<dir>/SKILL.md` programmatically as `cook/<dir>`, with its absolute location; cook's own three with autoinvoke off |
| Slash command mapping | **Supported** — plugin commands, always namespaced: `/cook:drain`, `/cook:plan`, … | **Supported** — plugin-registered commands named `cook:<verb>`, typed `/cook:drain`, `/cook:plan`, … exactly as on Claude Code |
| Fresh-context subagent spawn | **Supported** — built-in Agent tool | **Supported** — the `subagent` tool with `agent: "general"`, never `background`, never a `sessionID` |
| Subagent output capture | **Supported** — the subagent's final message is the Agent tool's return value | **Supported** — the text inside the `<subagent … state="completed">` wrapper; a spawn the human pushed to the background (Ctrl+B) returns a notice, not an outcome — the completion notification is parsed instead |
| Structured mid-session ask (gates) | **Supported** — AskUserQuestion | **Supported** — the `question` tool; a "dismissed" error (headless `opencode run`) is not an answer: park the set and exit (ADR-0004) |
| Turn cap enforcement | **Blind** — the Agent tool exposes no per-spawn turn bound | **Blind** — a per-agent `steps` cap exists, but a capped child reports `completed` with a forced summary, so exhaustion is unrecognizable |
| Timeout kill | **Blind** — no way to bound or kill a running subagent | **Blind** — opencode has no subagent timeout |
| Interrupt detection | **Supported** — the human's Esc interrupts the running tool; the orchestrator observes the cancelled spawn | **Supported** — the human's Esc, pressed twice, interrupts; the running spawn returns `Subagent cancelled` |
| Cook-state read and mutation | **Supported** — the `Read`, `Edit`, and `Write` tools. `Edit` requires the file to have been read first in the session (the stale-read guard ground rule 1 asks for). Writes are **in place**: no rename-over-target primitive is offered | **Supported** — the `read`, `edit`, and `write` tools (`patch` on models opencode serves it to). **No** read-before-edit guard: ground rule 1's prior read is the orchestrator's own discipline. Writes are **in place**: no rename-over-target primitive is offered |
| RFC3339 UTC timestamps | **Supported** — `date -u +%Y-%m-%dT%H:%M:%SZ` through the Bash tool | **Supported** — `date -u +%Y-%m-%dT%H:%M:%SZ` through the `shell` tool |
| Subagent trace visibility | **Human-facing** — host-native: `/tasks` lists running and finished subagents and opens any one's transcript, the subagent panel shows live status, and each subagent's transcript persists at `~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl` | **Human-facing** — host-native: each spawn is a child session the human can open and follow in the TUI, and every session's messages persist in opencode's SQLite store under `~/.local/share/opencode` |

Neither host's file tools perform a rename-over-target — they write in place.
That is why the portable core states the **guarantee** (one write per
transition; facts that must land together land in one write) rather than a
mechanism: the guarantee is holdable, the temp-file-and-rename recipe is not
(ADR-0008).

Both Blind rows are Blind on both hosts, and both follow pop's rule: cook
never emits a bound it cannot recognize, and the spec keeps the behavior
(turn-cap exhaustion outcome, the resume lesson) defined so a Supported host
slots in without a spec change.

The **Human-facing** row is the opposite case: no cook behavior waits on it,
so there is nothing to keep dormant and nothing for a future host to unlock.
It is in the matrix because a human asks about it, not because cook does
(ADR-0009).

## No loop hardening

Cook ships no hook that keeps the orchestrator going (ADR-0015). If the
orchestrator model ends its turn while the drain is mid-flight, the human
types `/cook:drain` again. All state lives in files (doc 01), so the new
Implement run re-derives everything and resumes exactly where the drain
stopped.

## Per-host layout

```
cook/
├── prompts/            ← shared, single copy (doc 09's files)
├── conventions/        ← cook's shipped conventions (doc 07; edits in doc 09 §11)
├── PROVENANCE.md       ← the vendored companion skills' upstream record
├── LICENSE-mattpocock-skills  ← their upstream license, verbatim
├── skills/             ← shared, single copy: the drain orchestration skill
│                         + authoring contract (agentskills standard), plus
│                         the five vendored companion skills (ADR-0010).
├── docs/               ← this spec set
├── claude-code/        ← the Claude Code plugin
│   ├── commands/       ← /cook:drain, /cook:plan, /cook:register,
│   │                     /cook:status, /cook:verify, /cook:refine
│   └── skills/         → symlink to ../skills
├── opencode/           ← the opencode v2 plugin (the whole adapter)
│   ├── index.ts        ← registers the six commands and eight skills,
│   │                     and appends the runtime trailer
│   ├── commands/       ← cook:drain … cook:refine, each mirroring
│   │                     claude-code/commands/<verb>.md
│   ├── smoke-test.sh   ← checks the opencode matrix column against the
│   │                     installed binary
│   └── package.json    ← @opencode/plugin, pinned to 2.0.20
```

The prompts and skills directories live at the repo root, outside the host
adapters: a pop prompt port lands once, the Claude Code plugin reaches the
one `skills/` copy through a relative symlink, and the opencode plugin
resolves the repo root from its own location. Only the command wiring is
host-specific.

Each host has one delivery note (ADR-0006), under `skills/drain/references/`,
and each host's command wiring names its own; skill text only ever says
"your host's delivery note":

- `host-claude-code.md` — Claude Code;
- `host-opencode.md` — opencode.

### claude-code specifics

- Attempts, Verifier, Refiner: Agent tool spawns with the rendered prompt as
  the task text; the return value is parsed for sentinels / VERDICT /
  REFINE-OUTCOME and the report. The Refiner is a write-capable spawn like an
  attempt (it edits the checkout); its licence is the prompt's, not a tool
  restriction — pop retired the read-only posture for the same reason
  (pop ADR-0221, amended).
- The shipped conventions resolve at `${CLAUDE_PLUGIN_ROOT}/conventions/`.
- Gates: AskUserQuestion with the gate's allowed outcomes (doc 08).
- The plugin's drain skill is the orchestrator instruction set; the
  `/cook:drain` command invokes it.
- The **plugin root is the repo root** (`.claude-plugin/plugin.json` at the
  top, pointing `commands` into `claude-code/`): plugin paths
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

### opencode specifics

- **One plugin is the adapter** (ADR-0014): `opencode/index.ts`, an opencode
  v2 plugin (`Plugin.define`, `@opencode/plugin` pinned to 2.0.20). opencode
  has no counterpart to `${CLAUDE_PLUGIN_ROOT}` and markdown commands cannot
  resolve their own location, so the plugin resolves the cook repo root from
  its own file and is what points shipped text at the one shared copy.
- Attempts, Verifier, Refiner: `subagent` spawns (`agent: "general"`, the
  rendered prompt as `prompt`); the completed wrapper's text is parsed for
  sentinels / VERDICT / REFINE-OUTCOME and the report, exactly as on Claude
  Code. A backgrounded spawn is waited for, never recorded as an outcome.
- Gates: the `question` tool with the gate's allowed outcomes (doc 08).
- **Skill ids are `cook/<dir>`.** opencode derives skill ids from folder
  names with no plugin namespace, lets a later source with the same id win,
  and also reads `~/.claude/skills`; the `cook/` prefix plays the role of
  Claude Code's `cook:`, so a user's own `grilling` or `to-spec` and cook's
  copy never shadow each other. All eight root skills are registered with
  their absolute `SKILL.md` location, so opencode's injected base directory
  resolves their relative references. opencode ignores
  `disable-model-invocation`, so cook's own three (`cook/drain`, `cook/plan`,
  `cook/register`) are registered with autoinvoke off; the five vendored
  companions keep the default and stay verbatim (ADR-0010), which is what
  makes `/cook:plan` work on a bare install.
- **Command spelling is `/cook:<verb>`**, the same as Claude Code: the six
  commands are registered as `cook:drain`, `cook:plan`, `cook:register`,
  `cook:status`, `cook:verify`, `cook:refine`. The colon autocompletes and
  runs in the 2.0.20 TUI, so the nested `/cook/<verb>` fallback is unused
  (ADR-0014, amendment). Each command's text is
  `opencode/commands/<verb>.md`, mirroring `claude-code/commands/<verb>.md`
  with `${COOK_ROOT}` in place of `${CLAUDE_PLUGIN_ROOT}`; arguments land
  where Claude Code puts `$ARGUMENTS`.
- **Every command ends with a runtime trailer** the plugin appends: the cook
  root, the skills, prompts, and conventions directories, and the opencode
  delivery note's path. The shipped conventions resolve at the trailer's
  conventions directory.
- The delivery note mapping each capability the skills name to its
  mechanism (ADR-0006) is `skills/drain/references/host-opencode.md`.
- **Install routes.** Supported: the cook checkout's `opencode/` directory
  in opencode's `plugins` config array, after `npm ci` in that directory
  (opencode installs no dependencies for a checkout-path plugin); installing
  and developing are the same step. Not yet supported: a git-spec install
  (`opencode plugin add`, subpath spelled `#path:opencode` in 2.0.20)
  installs only the `opencode/` subfolder, so the repo-root `skills/`,
  `prompts/`, and `conventions/` are unreachable — revisit when opencode
  keeps the repo root. `opencode/smoke-test.sh` re-checks this column, and
  reports that git-spec finding, against the installed opencode.

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

- `GLOSSARY.md` — **Agent adapter** / adapter-capability entries (the
  Supported/Blind declaration pattern; the third value, **Human-facing**, is
  cook's own addition — ADR-0009, ledgered as a divergence), **Agent preset**
- `docs/adr/0165`, `docs/adr/0166` (capability declaration seams),
  `docs/adr/0190` (turn cap: only the enforcer emits the bound; Blind
  declarations name their reason)
- `integrate/issue-tracker.md` and `GLOSSARY.md` **Issue tracker doc** — the
  adapter-doc mechanism `/cook:plan` reuses
- Claude Code facts from the
  plugin/skill/Agent-tool surface in current Claude Code, its `/tasks` view,
  and its per-session `subagents/*.jsonl` transcripts
- opencode facts from opencode v2.0.20 as installed
  (`~/.opencode/bin/opencode`) and the V2 docs at
  https://opencode.ai/v2/docs/ (the unversioned docs describe V1), checked
  by `opencode/smoke-test.sh`; the decisions are cook ADR-0014 and its
  amendment
