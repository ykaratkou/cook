# 10 — Hosts

Cook's portable core is a markdown skill set (both hosts implement the
agentskills standard); everything host-specific is an adapter declared here.
The declaration pattern is ported from pop's adapter capabilities: a host
declares each capability **Supported** (cook may rely on it, with the named
mechanism), **Blind** (cook must not rely on it; the spec'd behavior stays
dormant until a host can enforce it), or **Human-facing** (the capability's
audience is the human; no cook logic may rely on it). A Blind declaration
carries the reason, so a human can see what the host would need. A
Human-facing declaration has no reason to carry: nothing depending on it is
the design, not a gap (ADR-0009).

## Capability matrix

| Capability | claude-code | pi (v0.84.2) |
|---|---|---|
| Markdown skills (agentskills standard) | **Supported** — `.claude/skills/`, plugin skills | **Supported** — native; reads `.agents/skills/`, `.pi/skills/`, and can be pointed at `~/.claude/skills` |
| Slash command mapping | **Supported** — plugin commands, always namespaced: `/cook:drain`, `/cook:plan`, … | **Supported** — extension-registered commands (`pi.registerCommand`), namespaced identically to claude-code: `/cook:drain`, `/cook:plan`, … (ADR-0007; hyphen names are the recorded fallback if colons ever fail) |
| Fresh-context subagent spawn | **Supported** — built-in Agent tool | **Supported via prerequisite** — no built-in subagent (deliberate); cook requires `@tintinweb/pi-subagents` and names its `Agent` tool directly, called with `subagent_type: "general-purpose"`, `isolated: true`, `run_in_background: false`. Cook writes no spawn code on this host (ADR-0011) |
| Subagent output capture | **Supported** — the subagent's final message is the Agent tool's return value | **Supported, host-framed** — the foreground `Agent` result is a one-line stats header, a blank line, then the subagent's final message; the reply is everything after that blank line, and the delivery note states the framing so the core's *first line of the reply* keeps meaning what it says |
| Subagent sealing | n/a (in-process subagent) | **Supported** — `isolated: true` strips every extension and skill from the child, and pi suppresses AGENTS.md / CLAUDE.md for every subagent regardless, so the attempt sees only cook's prompt and the repo. The prompt is a tool parameter, never a command line |
| Structured mid-session ask (gates) | **Supported** — AskUserQuestion | **Supported** — the `cook_gate` tool over `ctx.ui.select` / `ctx.ui.confirm` / `ctx.ui.input`; errors (never defaults) when the session has no UI |
| Turn cap enforcement | **Blind** — the Agent tool exposes no per-spawn turn bound | **Blind in v1, Supported-capable** — pi-subagents' `Agent` takes `max_turns` and reports `aborted at the turn limit`; declared Blind for v1 symmetry with claude-code, and the delivery note forbids passing one. The digest's turn-cap lesson (doc 05) stays dormant on both |
| Timeout kill | **Blind** — no way to bound or kill a running subagent | **Blind** — cook no longer owns the child, so it has no timer to hang a kill on. pi-subagents can stop a run it owns (`subagents:rpc:stop`), but cook's skills call the `Agent` tool rather than driving that bus, and a spawn cook did not make over RPC is not cook's to stop |
| Loop-hardening hook (optional) | **Human-facing** — a stop hook re-injects "continue the drain" when the orchestrator ends its turn with the set non-terminal; scoped to the orchestrator session by matching the lock's `session` token against the stopping session's own transcript (the orchestrator typed it), silent in every other session | **Human-facing** — `agent_settled` event + `pi.sendUserMessage()`, purpose-built for exactly this; scoped to the orchestrator session by matching the lock's `session` field against `ctx.sessionManager.getSessionId()` (the command trailer supplies the id the orchestrator records), silent in every other session |
| Interrupt detection | **Supported** — the human's Esc interrupts the running tool; the orchestrator observes the cancelled spawn | **Supported** — the extension observes the aborted child / `ctx.abort()` |
| Cook-state read and mutation | **Supported** — the `Read`, `Edit`, and `Write` tools. `Edit` requires the file to have been read first in the session (the stale-read guard ground rule 1 asks for). Writes are **in place**: no rename-over-target primitive is offered | **Supported** — the built-in `read`, `edit`, and `write` tools (verified present in pi 0.84.2; its documented built-in set is `read, bash, edit, write, grep, find, ls`). `edit` takes **several disjoint `{oldText, newText}` replacements in one call**, so "two facts land in one write" is expressible on this host as well; `edit` requires the file to have been read first (each `oldText` must match the current bytes exactly and be unique), which is the stale-read guard ground rule 1 asks for. Writes are **in place**: no rename-over-target primitive is offered |
| RFC3339 UTC timestamps | **Supported** — `date -u +%Y-%m-%dT%H:%M:%SZ` through the Bash tool | **Supported** — `date -u +%Y-%m-%dT%H:%M:%SZ` through the built-in `bash` tool; the same invocation, byte-for-byte, on both hosts |
| Subagent trace visibility | **Human-facing** — host-native: `/tasks` lists running and finished subagents and opens any one's transcript, the subagent panel shows live status, and each subagent's transcript persists at `~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl` | **Human-facing via prerequisite** — pi-subagents' own surfaces: the live widget and FleetView while a run is in flight, and an `.output` transcript per run under the session directory. Cook neither produces nor reads any of it |

Neither host's file tools perform a rename-over-target — both write in
place. That is why the portable core states the **guarantee** (one write per
transition; facts that must land together land in one write) rather than a
mechanism: the guarantee is holdable on both hosts, the temp-file-and-rename
recipe on neither (ADR-0008).

Both Blind rows follow pop's rule: cook never emits a bound it cannot
recognize, and the spec keeps the behavior (turn-cap exhaustion outcome, the
resume lesson) defined so a Supported host slots in without a spec change.

The two **Human-facing** rows are the opposite case: no cook behavior waits on
them, so there is nothing to keep dormant and nothing for a future host to
unlock. They are in the matrix because a human comparing the hosts asks about
them, not because cook does (ADR-0009).

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
│                         Skill directories only — pi reads a stray root
│                         .md here as a skill
├── docs/               ← this spec set
├── claude-code/        ← the Claude Code plugin
│   ├── commands/       ← /cook:drain, /cook:plan, /cook:register,
│   │                     /cook:status, /cook:verify, /cook:review
│   ├── skills/         → symlink to ../skills
│   └── hooks/          ← optional stop-hook hardening
└── pi/                 ← the pi adapter
    ├── extension/      ← one TS extension: cook_gate (ctx.ui asks) + the
    │                     six commands + optional agent_settled hardening
    │                     + the pi-subagents prerequisite probe. No spawn
    │                     code: that capability is a prerequisite package
    ├── prompts/        → symlink to ../prompts
    └── skills/         → symlink to ../skills
```

The prompts and skills directories are **shared, never duplicated per host**:
a pop prompt port lands once, and both hosts reach the one `skills/` copy
through relative symlinks. Only the command wiring and the pi extension
differ.

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
  (`commands/drain.md`) on both hosts, accepted as the surface (user decision,
  2026-08-20; ADR-0007). A personal command at `~/.claude/commands/cook.md`
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
  for pi.
- The five vendored companion skills sit in that same directory and are
  registered the same way, as `cook:grill-with-docs`, `cook:grilling`,
  `cook:domain-modeling`, `cook:to-spec`, `cook:to-tickets`. They keep
  upstream's frontmatter, so — unlike cook's own three — they are meant to be
  invoked, which is what makes `/cook:plan` work on a bare install
  (ADR-0010).

### pi specifics

- Subagent spawn is a **prerequisite, not cook code** (ADR-0011).
  `@tintinweb/pi-subagents` must be installed
  (`pi install @tintinweb/pi-subagents`), and cook's skills name its
  `Agent` tool directly. Cook's extension probes for it once per session,
  over that package's own discovery surface — the `subagents:ready`
  announcement, with a `subagents:rpc:ping` covering the case where it
  announced before cook was listening — and warns the human with the
  install command if neither answers. A warning, never an error:
  `/cook:status` and `/cook:register` spawn nothing and work regardless.
- Cook's one TS extension (`pi/extension/index.ts`) therefore registers a
  single tool, **`cook_gate`** (the gate ask over `ctx.ui`; an error when
  the session has no UI, so headless runs park instead of defaulting),
  plus the six commands, the prerequisite probe, and optionally the
  `agent_settled` hardening.
- Commands are **extension-registered** (`pi.registerCommand`), the same
  namespaced verb set as claude-code: `/cook:drain`, `/cook:plan`,
  `/cook:register`, `/cook:status`, `/cook:verify`, `/cook:review`
  (ADR-0007). Each handler resolves the skill file, the shared prompts
  dir, and the skills dir from the extension's own location
  (`import.meta.url`) at invocation and injects those absolute paths into
  the user message — no path is ever baked into shipped text.
- A **Subagent trace** on this host is whatever pi-subagents keeps: its
  live widget and FleetView during a run, and the `.output` transcript it
  files under the session directory. Never under `.cook/` — a trace is the
  host's artifact, so doc 01's storage contract does not describe it and no
  derived status changes when one is deleted. Nothing in cook reads one
  (ADR-0009), so no delivery note maps it, and cook no longer produces one
  either.
- Skills are **not namespaced** on this host: pi has one flat skill namespace
  with a location precedence (global `~/.pi/agent/skills/`, then
  `~/.agents/skills/`, then project dirs, then packages) and keeps the first
  skill found, warning about the rest under `[Skill conflicts]`. Cook's
  package copies therefore lose to a human's own copy of the same skill,
  which is the intended precedence for the vendored companions (ADR-0010) and
  harmless for cook's own three, since the commands load those by absolute
  path rather than by name.
- pi also loads every root-level `.md` file of a package's skills directory as
  a skill, and refuses one with no `description`. Nothing but skill
  directories belongs in `skills/`: the provenance record and the license copy
  for the vendored companions live at the repo root.
- Per-host delivery notes map each capability the skills name to its
  mechanism (ADR-0006): `skills/drain/references/host-pi.md` for this
  host, `skills/drain/references/host-claude-code.md` for the other.
- Everything else — skills, prompts, storage, flows — is the shared core.

## Companion skills for `/cook:plan`

`/cook:plan` (doc 03's front door) orchestrates skills cook did not author but
**does ship**: `grill-with-docs` (interview; ADRs + glossary), `to-spec` (the
spec document), and `to-tickets` (decomposition into the task set), plus the
two `grill-with-docs` itself loads — `grilling` and `domain-modeling`. They are
verbatim copies of [mattpocock/skills](https://github.com/mattpocock/skills)
(MIT), vendored under `skills/` as one directory per skill, so both hosts
discover them exactly as they discover cook's own three (ADR-0010).

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
- Pi facts verified against pi-coding-agent v0.84.2 local install and docs
  (`docs/extensions.md`, `skills.md`, `prompt-templates.md`, `json.md`,
  `usage.md`, `examples/extensions/subagent/`, and `dist/core/tools/edit.js`
  for `edit`'s multi-`edits[]` shape); Claude Code facts from the
  plugin/skill/Agent-tool surface in current Claude Code, its `/tasks` view,
  and its per-session `subagents/*.jsonl` transcripts
