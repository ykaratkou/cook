# Host-neutralize the skill text and add per-host delivery notes

## Parent
`spec.md` in this set; `docs/adr/0006` (the decision this task executes);
`docs/spec/10-hosts.md` capability matrix (the capability names to use);
CONTEXT.md entry **Delivery note**.

## What to build

The skill files under `skills/` currently hardcode claude-code mechanisms.
Rewrite them so skill text names **capabilities**, and each host's concrete
mechanism lives in one delivery note per host.

1. Write the delivery notes at `skills/drain/references/host-claude-code.md`
   and `skills/drain/references/host-pi.md`. Each maps every capability the
   skills name to the host mechanism, at minimum:
   - **Fresh-context subagent spawn** — claude-code: the Agent tool,
     `subagent_type: "general-purpose"`, rendered prompt as task text,
     return value is the run's output. pi: the `cook_subagent` tool,
     `{ prompt }`, result text is the run's output (details carry
     stopReason/usage).
   - **Structured gate ask** — claude-code: AskUserQuestion. pi: the
     `cook_gate` tool (`kind: select | confirm | input`); an error result
     means the session has no UI — gates are attended-only, park the set
     and exit; never treat it as an answer.
   - **The shared prompts directory** — claude-code:
     `${CLAUDE_PLUGIN_ROOT}/prompts/`. pi: the absolute path the cook
     command message carries (the extension resolves and injects it);
     never a guessed path.
   - **Session identifier for `drain.lock`** — best available handle on
     each host.
   The pi note may forward-reference tools task 03/04 build; write it to
   the spec'd contract, not to code.
2. Rewrite the host-specific passages in `skills/drain/SKILL.md` (at
   least: "Rendering prompts" delivery line, "Spawning subagents", lock
   session identifier) and in `skills/drain/references/*.md` (attempt,
   gates, verify, review mention the Agent tool / AskUserQuestion) to name
   the capability and point at the delivery note once:
   "per your host's delivery note (references/host-claude-code.md or
   references/host-pi.md)". Also sweep `skills/plan/SKILL.md` and
   `skills/register/SKILL.md` for host-specific text (plan's companion
   check already reads host-neutrally; leave semantics untouched).
   `references/format-contract.md` is a verbatim spec copy — do not edit it.
3. Add `disable-model-invocation: true` to the frontmatter of all three
   SKILL.md files, keeping the existing keys.
4. Behavior must not change on claude-code: the same mechanisms, now
   reached through the note.

## Acceptance criteria

- [ ] `skills/drain/references/host-claude-code.md` and
      `skills/drain/references/host-pi.md` exist and each maps subagent
      spawn, gate ask, prompts path, and lock session identifier to that
      host's mechanism.
- [ ] `grep -rn "Agent tool\|AskUserQuestion\|CLAUDE_PLUGIN_ROOT\|subagent_type" skills/`
      hits only the two delivery notes (and no other file under `skills/`).
- [ ] All three `skills/*/SKILL.md` frontmatters contain
      `disable-model-invocation: true`.
- [ ] The drain skill and its references instruct spawning/gating/prompt
      resolution only via capability names plus a pointer to the delivery
      notes; no orchestration semantics (loop order, caps, gate outcomes)
      changed.
