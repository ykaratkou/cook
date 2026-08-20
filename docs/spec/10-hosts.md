# 10 — Hosts

Cook's portable core is a markdown skill set (both hosts implement the
agentskills standard); everything host-specific is an adapter declared here.
The declaration pattern is ported from pop's adapter capabilities: a host
declares each capability **Supported** (cook may rely on it, with the named
mechanism) or **Blind** (cook must not rely on it; the spec'd behavior stays
dormant until a host can enforce it). A Blind declaration carries the reason,
so a human can see what the host would need.

## Capability matrix

| Capability | claude-code | pi (v0.84.2) |
|---|---|---|
| Markdown skills (agentskills standard) | **Supported** — `.claude/skills/`, plugin skills | **Supported** — native; reads `.agents/skills/`, `.pi/skills/`, and can be pointed at `~/.claude/skills` |
| Slash command mapping | **Supported** — plugin commands; `/cook` resolves without namespace when unambiguous | **Supported** — prompt templates (`.pi/prompts/*.md`, filename = command) and skills as `/skill:name` |
| Fresh-context subagent spawn | **Supported** — built-in Agent tool | **Supported via adapter** — no built-in subagent (deliberate); cook ships one TS extension wrapping pi's first-party subagent pattern: spawn `pi --mode json -p "<prompt>"` as a child process |
| Subagent output capture | **Supported** — the subagent's final message is the Agent tool's return value | **Supported via adapter** — parse the child's `--mode json` JSONL stream; the final assistant message is the attempt output |
| Headless child sealing | n/a (in-process subagent) | **Supported** — child runs with `--no-session --no-extensions --no-skills --no-context-files` and a `--tools` allowlist, so the attempt sees only cook's prompt and the repo |
| Structured mid-session ask (gates) | **Supported** — AskUserQuestion | **Supported** — `ctx.ui.select` / `ctx.ui.confirm` / `ctx.ui.input` from the extension |
| Turn cap enforcement | **Blind** — the Agent tool exposes no per-spawn turn bound | **Blind** — no CLI turn cap on the child; the digest's turn-cap lesson (doc 05) stays dormant on both |
| Timeout kill | **Blind** — no way to bound or kill a running subagent | **Blind in v1, Supported-capable** — the spawning extension owns the child process and *could* kill it on a timer; declared Blind for v1 symmetry with claude-code. Revisit: this is the first capability pi can enforce that claude-code cannot |
| Loop-hardening hook (optional) | **Supported** — a stop hook can re-inject "continue the drain" when the orchestrator ends its turn with the set non-terminal | **Supported** — `agent_settled` event + `pi.sendUserMessage()`; purpose-built for exactly this |
| Interrupt detection | **Supported** — the human's Esc interrupts the running tool; the orchestrator observes the cancelled spawn | **Supported** — the extension observes the aborted child / `ctx.abort()` |

Both Blind rows follow pop's rule: cook never emits a bound it cannot
recognize, and the spec keeps the behavior (turn-cap exhaustion outcome, the
resume lesson) defined so a Supported host slots in without a spec change.

## Loop hardening is optional, correctness is not

The hooks in the matrix's hardening row protect against one failure mode only:
the orchestrator model ending its turn while the drain is mid-flight.
Correctness never depends on them — all state lives in files (doc 01), so
re-invoking `/cook` re-derives everything and resumes exactly where the drain
stopped. A host with no hook support runs cook correctly; the human just
occasionally types `/cook` again.

## Per-host layout

```
cook/
├── prompts/            ← shared, single copy (doc 09's files)
├── docs/               ← this spec set
├── claude-code/        ← the Claude Code plugin
│   ├── commands/       ← /cook, /cook:plan, /cook:register, /cook:status,
│   │                     /cook:verify, /cook:review
│   ├── skills/         ← the drain orchestration skill + authoring contract
│   └── hooks/          ← optional stop-hook hardening
└── pi/                 ← the pi adapter
    ├── extension/      ← one TS extension: subagent spawn + sealing +
    │                     ctx.ui gate asks + optional agent_settled hardening
    ├── prompts/        → symlink or build-copy of ../prompts
    └── skills/         ← the same skill files (agentskills standard)
```

The prompts directory is **shared, never duplicated per host**: a pop prompt
port lands once. Skills are likewise shared text; only the command wiring and
the pi extension differ.

### claude-code specifics

- Attempts, Verifier, Reviewer: Agent tool spawns with the rendered prompt as
  the task text; the return value is parsed for sentinels / VERDICT / the
  review document.
- Gates: AskUserQuestion with the gate's allowed outcomes (doc 08).
- The plugin's drain skill is the orchestrator instruction set; the bare
  `/cook` command invokes it.
- The **plugin root is the repo root** (`.claude-plugin/plugin.json` at the
  top, pointing `commands`/`skills`/`hooks` into `claude-code/`): plugin
  paths cannot reach outside the plugin root after installation, and rooting
  at the repo keeps `prompts/` a single shared copy
  (`${CLAUDE_PLUGIN_ROOT}/prompts`). Plugin commands are namespaced
  (`/cook:plan`); the drain command file is `commands/cook.md`, whose
  canonical form is `/cook:cook` and whose bare-name resolution is `/cook`.

### pi specifics

- Cook's one TS extension registers: the subagent-spawn tool (child `pi`
  processes, sealed as above, JSONL-parsed), the gate ask commands over
  `ctx.ui`, and optionally the `agent_settled` hardening. It follows pi's
  shipped first-party subagent example (`examples/extensions/subagent/`); the
  published `pi-subagents` package is the same pattern.
- Commands: prompt templates named for the cook verbs.
- Everything else — skills, prompts, storage, flows — is the shared core.

## Companion skills for `/cook:plan`

`/cook:plan` (doc 03's front door) orchestrates three skills cook does **not**
ship: `grill-with-docs` (interview; ADRs + glossary), `to-spec` (the spec
document), and `to-tickets` (decomposition into the task set). Both hosts read
`~/.agents/skills/`, which is where these live.

- Cook ships an **issue-tracker adapter doc** (the mechanism those skills
  already use to pick a store): it names cook's store — `.cook/tasks/` in the
  target repo — and the register contract, so `to-tickets` publishes cook-shaped
  sets.
- A machine **without** the companion skills loses `/cook:plan` only: sets can
  still be authored by hand or by any agent against doc 01's contract and
  validated with `/cook:register`. `/cook:plan` detects a missing companion and
  says which skill to install, rather than improvising a plan flow.

## Sources in pop

- `CONTEXT.md` — **Agent adapter** / adapter-capability entries (the
  Supported/Blind declaration pattern), **Agent preset**
- `docs/adr/0165`, `docs/adr/0166` (capability declaration seams),
  `docs/adr/0190` (turn cap: only the enforcer emits the bound; Blind
  declarations name their reason)
- `integrate/issue-tracker.md` and `CONTEXT.md` **Issue tracker doc** — the
  adapter-doc mechanism `/cook:plan` reuses
- Pi facts verified against pi-coding-agent v0.84.2 local install and docs
  (`docs/extensions.md`, `skills.md`, `prompt-templates.md`, `json.md`,
  `usage.md`, `examples/extensions/subagent/`); Claude Code facts from the
  plugin/skill/Agent-tool surface in current Claude Code
