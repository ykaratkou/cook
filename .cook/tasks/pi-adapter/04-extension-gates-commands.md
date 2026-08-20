# cook_gate tool and the six namespaced cook commands

## Parent
`spec.md` in this set (Implementation Decisions: cook_gate, commands);
`docs/adr/0007` (extension-registered, namespaced); `docs/adr/0004`
(attended-only); the delivery note `skills/drain/references/host-pi.md`
from task 02 (this task makes that note true). Pi docs: `extensions.md`
(`registerCommand`, `sendUserMessage`, `ctx.ui`, `ctx.hasUI`).

## What to build

Extend `pi/extension/index.ts` with the gate tool and the command surface.

1. **`cook_gate` tool**: parameters
   `{ kind: "select" | "confirm" | "input", title: string,
   options?: string[], message?: string, placeholder?: string }`.
   Map to `ctx.ui.select(title, options)`, `ctx.ui.confirm(title, message)`,
   `ctx.ui.input(title, placeholder)`. Return the human's answer as the
   result text (`confirm` → `"yes"`/`"no"`; a dismissed `select`/`input`
   returning `undefined` → an explicit "dismissed — re-ask or park; not an
   answer" error result). When `ctx.hasUI` is false, return an error result
   stating gates are attended-only (ADR-0004) and the orchestrator must
   park the set and exit with the disposition. Never default an answer.
2. **Commands**: `pi.registerCommand` for `cook:drain`, `cook:plan`,
   `cook:register`, `cook:status`, `cook:verify`, `cook:review`. Verify
   empirically that colon names register and dispatch in a real pi session;
   if they do not, fall back to `cook-<verb>` and record that in the
   command descriptions and in a note for task 06.
3. **Command behavior**: each handler resolves cook's directories from the
   extension's own file location (`import.meta.url` → the checkout root
   through `pi/`), reads the mapped skill file (`skills/drain/SKILL.md` for
   drain; `plan`, `register` for theirs; status/verify/review map to the
   drain skill's references per the claude-code command files — mirror
   `claude-code/commands/*.md` for the exact per-verb framing), and sends
   one user message via `pi.sendUserMessage` containing: the per-verb
   framing, the skill text (or an instruction to read it at the resolved
   absolute path — choose one, consistently), the user's arguments, and a
   trailer block with the runtime-resolved absolute paths of the prompts
   dir, skills dir, and delivery note. No path may be baked at authoring
   time. Handle the streaming case (`deliverAs` required when not idle) by
   passing `deliverAs: "followUp"` when the agent is running.
4. Each command gets a `description` so pi's command list reads sensibly.

## Acceptance criteria

- [x] `cook_gate` is registered with the parameter shape above; `select`,
      `confirm`, and `input` each round-trip a real answer in an attended
      pi session.
- [x] With no UI (`pi --mode json` or `-p`), `cook_gate` returns the
      attended-only error result — verified by a scripted headless
      invocation; no defaulted answer is possible.
- [x] All six cook verbs appear in pi's command list and dispatch; the
      chosen names (colon or recorded fallback) are stated in the task's
      summary.
- [x] Invoking `/cook:status` in a pi session in this repo injects the
      status instruction set with runtime-resolved absolute paths (prompts
      dir, skills dir) visible in the injected message — no baked paths
      anywhere in `pi/extension/`.
- [x] The typecheck from task 03 still passes over the grown extension.
