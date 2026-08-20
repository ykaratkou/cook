# Spec: the pi host adapter

Planning spec for task set `pi-adapter` (context only — the task files'
acceptance criteria remain authoritative). Synthesized from the grill of
2026-08-20; decisions recorded in ADR-0006 and ADR-0007.

## Problem Statement

Cook's spec set declares two hosts, but only the claude-code plugin exists.
On pi there is no way to run a drain: no fresh-context subagent spawn, no
structured gate asks, no command surface. The portable core is also not yet
actually portable — the shipped skill files hardcode claude-code mechanisms
(`${CLAUDE_PLUGIN_ROOT}`, the Agent tool, AskUserQuestion), so sharing them
with a second host as-is would ship wrong instructions.

## Solution

Ship the `pi/` host adapter at full command parity, per
`docs/spec/10-hosts.md` and verified against pi-coding-agent v0.84.2: one
TypeScript extension providing sealed subagent spawn (`cook_subagent`),
structured gate asks (`cook_gate`), the six namespaced cook commands, and
optional `agent_settled` loop hardening. Make the skills genuinely shared:
move them to a repo-root `skills/` directory (symlinked from both host
directories), rewrite host-specific passages to name capabilities, and add
per-host delivery notes mapping each capability to its mechanism.

## User Stories

1. As a pi user, I want to run `/cook:drain` inside pi, so that a task set
   drains on pi exactly as it does on Claude Code.
2. As a pi user, I want `/cook:plan`, `/cook:register`, `/cook:status`,
   `/cook:verify`, and `/cook:review` available in pi, so that the whole
   cook surface works without switching hosts.
3. As the drain orchestrator on pi, I want a `cook_subagent` tool that
   spawns a sealed fresh-context child, so that every Attempt, Verifier
   run, and Reviewer run has pop-grade isolation.
4. As the drain orchestrator on pi, I want the child's final assistant
   message returned as the tool result, so that sentinel/VERDICT parsing
   works identically to the Agent tool on Claude Code.
5. As the drain orchestrator on pi, I want a `cook_gate` tool over pi's
   dialog UI, so that every gate outcome is the human's structured answer,
   never my improvisation.
6. As a human at a gate, I want select/confirm/input dialogs with the
   gate's allowed outcomes, so that deciding is one keypress.
7. As a human running cook headless (`--mode json` / `-p`), I want gate
   asks to fail loudly instead of silently defaulting, so that attended-only
   semantics (ADR-0004) are never violated.
8. As a cook maintainer, I want the skill files to name capabilities and
   the hosts to supply delivery notes, so that a ported prompt or flow
   change lands once, not per host.
9. As a cook maintainer, I want the skills in one root directory with
   host symlinks, so that "shared, never duplicated" is literally true in
   the checkout, as it already is for `prompts/`.
10. As a pi user, I want cook installed by pointing settings arrays at my
    cook checkout, so that installation is a two-line settings edit.
11. As a pi user, I want the cook commands to resolve skill and prompt
    paths at runtime from the extension's own location, so that no
    machine-specific path is baked into any shipped file.
12. As a pi user, I want the drain to survive the orchestrator model ending
    its turn mid-flight, so that long drains do not need babysitting
    (`agent_settled` re-injection, mirroring the claude-code stop hook).
13. As a cook maintainer, I want the spec set and parity ledger updated
    where implementation contradicted them, so that the docs-first rule
    (spec is binding) survives the port.
14. As a human signing off, I want a toy drain to have actually run inside
    pi before I sign, so that the adapter ships executed, not just written.
15. As the model inside a pi session, I want the drain/plan/register skills
    hidden from my own initiative (`disable-model-invocation`), so that a
    drain only ever starts from an explicit command.

## Implementation Decisions

- **One TypeScript extension**, a single directory with an `index.ts`
  default-exporting the factory. Pi loads TS directly (jiti); there is no
  build step. Imports only `@earendil-works/pi-coding-agent` types,
  `typebox`, and node builtins.
- **`cook_subagent`** (registered tool): parameters `{ prompt }`. Spawns a
  child `pi --mode json -p --no-session --no-extensions --no-skills
  --no-context-files --no-prompt-templates --tools
  read,bash,edit,write,grep,find,ls`. All seven built-ins for every spawn
  kind; the model is inherited (no `--model`). **The prompt is delivered on
  stdin** (`-p` merges piped stdin into the prompt) — prompts never ride
  argv (parity ledger: pop's prompt-spill exclusion). The tool parses the
  JSONL stream, returns the text of the last `message_end` with
  `role: "assistant"`; stopReason, usage, exit code, and a stderr tail go
  in tool details. Abort sends SIGTERM, then SIGKILL after 5s. Child
  failure (non-zero exit, stopReason error/aborted) is an error result; a
  spawn that fails before the child runs consumes no attempt (orchestrator
  rule, doc 04).
- **`cook_gate`** (registered tool): parameters `{ kind: select | confirm |
  input, title, options?, message?, placeholder? }`, mapped to
  `ctx.ui.select` / `ctx.ui.confirm` / `ctx.ui.input`. When `ctx.hasUI` is
  false the tool returns an error stating gates are attended-only
  (ADR-0004) and the orchestrator must park the set and exit — a UI no-op
  `undefined` must never read as a human answer.
- **Commands** are extension-registered (`pi.registerCommand`), not prompt
  templates — ADR-0007. Names: `cook:drain`, `cook:plan`, `cook:register`,
  `cook:status`, `cook:verify`, `cook:review` (hyphen fallback recorded if
  colons fail empirically). Each handler resolves the skill file from the
  extension's own location, injects the skill text plus the user's
  arguments as a user message (`pi.sendUserMessage`), and appends the
  runtime-resolved absolute paths (prompts dir, skills dir, repo cwd) so
  the orchestrator never guesses a path.
- **`agent_settled` hardening**: on the event, if a fresh (< 10 min)
  `drain.lock` exists under `.cook/tasks/*/`, re-inject the same
  continue-the-drain instruction the claude-code stop hook emits, bounded
  to once per settle (mirror `stop_hook_active` semantics: never re-inject
  twice in a row without an intervening real turn).
- **Skills move to repo-root `skills/`**; `claude-code/skills` and
  `pi/skills` become relative symlinks to it. `pi/prompts` is a relative
  symlink to `../prompts`.
- **Skills name capabilities** (ADR-0006): fresh-context subagent spawn,
  structured gate ask, the shared prompts path. Per-host delivery notes
  (`host-claude-code.md`, `host-pi.md` under the drain skill's references)
  map capability → mechanism. Skill frontmatter gains
  `disable-model-invocation: true` (honored by pi; inert on claude-code
  where the skills are not registered).
- **Install** is settings path arrays (user decision, grill Q8): an
  `extensions` entry and a `skills` entry pointing at the cook checkout, in
  `~/.pi/agent/settings.json` (paths resolve relative to `~/.pi/agent`;
  absolute and `~` supported) or a project's `.pi/settings.json`. No
  `package.json` distribution in v1.
- **Spec edits carried by this set**: 10-hosts command row and pi
  specifics (extension-registered commands, `/cook:drain`), the per-host
  layout diagram (root `skills/`), the sealing row
  (`--no-prompt-templates`), ADR-0003's "unnamespaced `/cook`" sentence
  superseded by ADR-0007. Timeout kill stays **Blind** (grill Q4).

## Testing Decisions

- The highest seam is the pi CLI boundary itself: a smoke script exercises
  the sealed-child contract (spawn with the exact seal argv, prompt on
  stdin, JSONL out, final-assistant-message extraction) against the real
  locally installed `pi` — external behavior only, no mocking of pi.
- The extension typechecks (`tsc --noEmit`) with pi's real types resolved
  from the local installation; no `any`-laundering of the ExtensionAPI.
- The full-stack seam is an attended toy drain inside pi at the HITL
  sign-off: commands, spawn, gates, and hardening observed live. Prior
  art: the claude-code plugin was verified the same way.
- No unit-test harness is introduced for v1 — the repo is docs-first with
  no existing test infrastructure, and the two seams above cover the only
  new executable code.

## Out of Scope

- Flipping timeout kill to Supported on pi (first candidate for v2; the
  spec's Revisit note stands).
- `package.json` / pi-package distribution.
- Any change to drain/verify/review/gate semantics — this set ports the
  host, not the flows.
- Turn-cap enforcement (Blind on both hosts, unchanged).
- Windows support for the symlink layout.

## Further Notes

- Pi facts pinned to v0.84.2 at
  `/opt/homebrew/Cellar/pi-coding-agent/0.84.2/…`; the shipped
  `examples/extensions/subagent/` is the reference implementation for the
  spawn/parse/abort path.
- The `pi-subagents` npm package is not available locally; the example is
  the only readable implementation and is first-party.
- Non-interactive child runs never show a trust prompt (they fall back to
  `defaultProjectTrust`) — the sealed child needs no trust ceremony.
