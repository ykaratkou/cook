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
| Slash command mapping | **Supported** — plugin commands, always namespaced: `/cook:drain`, `/cook:plan`, … | **Supported** — extension-registered commands (`pi.registerCommand`), namespaced identically to claude-code: `/cook:drain`, `/cook:plan`, … (ADR-0007; hyphen names are the recorded fallback if colons ever fail) |
| Fresh-context subagent spawn | **Supported** — built-in Agent tool | **Supported via adapter** — no built-in subagent (deliberate); cook ships one TS extension wrapping pi's first-party subagent pattern: the `cook_subagent` tool spawns `pi --mode json -p` as a child process, prompt delivered on stdin |
| Subagent output capture | **Supported** — the subagent's final message is the Agent tool's return value | **Supported via adapter** — parse the child's `--mode json` JSONL stream; the final assistant message is the attempt output |
| Headless child sealing | n/a (in-process subagent) | **Supported** — child runs with `--no-session --no-extensions --no-skills --no-context-files --no-prompt-templates` and a `--tools` allowlist, so the attempt sees only cook's prompt and the repo; the prompt travels via stdin, never argv |
| Structured mid-session ask (gates) | **Supported** — AskUserQuestion | **Supported** — the `cook_gate` tool over `ctx.ui.select` / `ctx.ui.confirm` / `ctx.ui.input`; errors (never defaults) when the session has no UI |
| Turn cap enforcement | **Blind** — the Agent tool exposes no per-spawn turn bound | **Blind** — no CLI turn cap on the child; the digest's turn-cap lesson (doc 05) stays dormant on both |
| Timeout kill | **Blind** — no way to bound or kill a running subagent | **Blind in v1, Supported-capable** — the spawning extension owns the child process and *could* kill it on a timer; declared Blind for v1 symmetry with claude-code. Revisit: this is the first capability pi can enforce that claude-code cannot |
| Loop-hardening hook (optional) | **Supported** — a stop hook re-injects "continue the drain" when the orchestrator ends its turn with the set non-terminal; scoped to the orchestrator session by matching the lock's `session` token against the stopping session's own transcript (the orchestrator typed it), silent in every other session | **Supported** — `agent_settled` event + `pi.sendUserMessage()`, purpose-built for exactly this; scoped to the orchestrator session by matching the lock's `session` field against `ctx.sessionManager.getSessionId()` (the command trailer supplies the id the orchestrator records), silent in every other session |
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
├── skills/             ← shared, single copy: the drain orchestration skill
│                         + authoring contract (agentskills standard)
├── docs/               ← this spec set
├── claude-code/        ← the Claude Code plugin
│   ├── commands/       ← /cook:drain, /cook:plan, /cook:register,
│   │                     /cook:status, /cook:verify, /cook:review
│   ├── skills/         → symlink to ../skills
│   └── hooks/          ← optional stop-hook hardening
└── pi/                 ← the pi adapter
    ├── extension/      ← one TS extension: cook_subagent (sealed spawn) +
    │                     cook_gate (ctx.ui asks) + the six commands +
    │                     optional agent_settled hardening
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
  resolve to plugin commands. The spec'd bare `/cook` is therefore not
  available on this host; the drain verb ships as `/cook:drain`
  (`commands/drain.md`), accepted as the surface (user decision,
  2026-08-20). A personal command at `~/.claude/commands/cook.md` loading
  the drain skill would restore the bare verb if ever wanted.
- The skill files under `claude-code/skills/` (a relative symlink to the
  shared root `skills/`) are deliberately **not registered** as plugin
  skills: commands and skills share one namespace in
  current Claude Code (registering both would collide `plan`/`register`),
  and the drain/plan/register instruction sets must never fire on the
  model's own initiative. The commands load them by path; the files keep the
  agentskills SKILL.md shape as the portable core for pi.

### pi specifics

- Cook's one TS extension (`pi/extension/index.ts`) registers two tools:
  **`cook_subagent`** (child `pi` processes, sealed as above, prompt on
  stdin, JSONL-parsed — the final assistant message is the result) and
  **`cook_gate`** (the gate ask over `ctx.ui`; an error when the session
  has no UI, so headless runs park instead of defaulting), plus optionally
  the `agent_settled` hardening. It follows pi's shipped first-party
  subagent example (`examples/extensions/subagent/`); the published
  `pi-subagents` package is the same pattern.
- Commands are **extension-registered** (`pi.registerCommand`), the same
  namespaced verb set as claude-code: `/cook:drain`, `/cook:plan`,
  `/cook:register`, `/cook:status`, `/cook:verify`, `/cook:review`
  (ADR-0007). Each handler resolves the skill file, the shared prompts
  dir, and the skills dir from the extension's own location
  (`import.meta.url`) at invocation and injects those absolute paths into
  the user message — no path is ever baked into shipped text.
- Per-host delivery notes map each capability the skills name to its
  mechanism (ADR-0006): `skills/drain/references/host-pi.md` for this
  host, `skills/drain/references/host-claude-code.md` for the other.
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
