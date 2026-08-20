# Pi extension with the sealed cook_subagent spawn tool

## Parent
`spec.md` in this set (Implementation Decisions: cook_subagent);
`docs/spec/10-hosts.md` pi capability rows; `docs/adr/0003`. Reference
implementation: `examples/extensions/subagent/index.ts` in the local pi
package (`/opt/homebrew/Cellar/pi-coding-agent/0.84.2/libexec/lib/node_modules/@earendil-works/pi-coding-agent/`),
docs `extensions.md`, `json.md`.

## What to build

Create `pi/extension/index.ts` — the cook pi extension's first slice: a
default-exported factory registering the `cook_subagent` tool.

1. **Tool contract**: parameters `{ prompt: string }` (TypeBox schema).
   Executes one sealed fresh-context child and returns its final assistant
   message text as the tool result content; tool details carry stopReason,
   usage (input/output/cacheRead/cacheWrite/cost.total), exit code, and a
   bounded stderr tail.
2. **The seal**: spawn the `pi` binary with exactly
   `--mode json -p --no-session --no-extensions --no-skills
   --no-context-files --no-prompt-templates --tools
   read,bash,edit,write,grep,find,ls`, cwd = the session's project cwd,
   `shell: false`. No `--model` flag (inherit the session default).
3. **Prompt on stdin, never argv**: write the prompt to the child's stdin
   and close it (`-p` merges piped stdin into the prompt); pass no
   positional prompt argument.
4. **JSONL parsing**: buffer stdout, split on newlines, JSON.parse per
   line, collect `message_end` records; the result text is the last one
   with `message.role === "assistant"`, first `content[]` part of
   `type: "text"`. Flush the trailing buffer on close.
5. **Abort**: on the tool's AbortSignal send SIGTERM, escalate to SIGKILL
   after 5 seconds, and return an aborted error result.
6. **Failure**: non-zero exit, or stopReason `error`/`aborted`, is an
   error result whose text falls back through errorMessage → stderr tail →
   final text. (The orchestrator charges no attempt for a spawn that
   fails before the child runs — that rule lives in the skills, not here.)
7. **Typecheck**: make `npx tsc --noEmit` (or the repo-documented
   equivalent) pass over `pi/extension/` with pi's real types resolved —
   via a dev-only `package.json`+lockfile if `@earendil-works/pi-coding-agent`
   is on npm, else a `tsconfig.json` path mapping into the local install;
   document the chosen mechanism in a comment or the tsconfig. No `any`
   casts of the ExtensionAPI surface.
8. **Smoke script**: `pi/extension/smoke-test.sh` — dependency-free bash
   that runs the exact seal argv against the real local `pi` with a trivial
   stdin prompt (e.g. "Reply with exactly: COOK-SMOKE-OK") and asserts the
   final-assistant-message extraction (the `message_end` filter) yields the
   expected marker. Exits non-zero on failure.

## Acceptance criteria

- [ ] `pi/extension/index.ts` default-exports a factory that registers a
      `cook_subagent` tool with the `{ prompt }` schema described above.
- [ ] The spawn argv is exactly the seal above, the prompt travels via
      stdin only, and grep shows no positional prompt argument and no
      `--model` in the spawn path.
- [ ] Abort handling (SIGTERM → SIGKILL after 5s) and the
      failure-detection rule (exit code / stopReason) are implemented as
      specified.
- [ ] The typecheck command documented in the task's implementation passes
      from a clean checkout on this machine.
- [ ] `pi/extension/smoke-test.sh` passes on this machine, proving seal +
      stdin prompt + final-message extraction against the real pi binary.
- [ ] Loading the extension in a pi session via a settings/`-e` path and
      invoking `cook_subagent` with a trivial prompt returns the child's
      reply (verifiable with `pi -e pi/extension/index.ts -p "..."` driving
      the tool, or an equivalent scripted check).
