# Cook on pi

This directory is cook's [pi](https://github.com/earendil-works/pi) host
adapter: one TypeScript extension plus symlinks into the shared core.
Everything cook *is* — the skills, the prompts, the storage contract — lives
at the repo root and is host-neutral; this adapter only supplies the pi
mechanisms those skills name (see `docs/spec/10-hosts.md` and
`skills/drain/references/host-pi.md`).

- `extension/index.ts` — the whole adapter. Registers:
  - **`cook_subagent`** — sealed fresh-context child spawn
    (`pi --mode json -p --no-session --no-extensions --no-skills
    --no-context-files --no-prompt-templates --tools
    read,bash,edit,write,grep,find,ls`, prompt on stdin, never argv);
    returns the child's final assistant message.
  - **`cook_gate`** — structured gate asks over `ctx.ui`
    (select / confirm / input); errors instead of defaulting when the
    session has no UI (gates are attended-only, ADR-0004).
  - The six commands: `/cook:drain`, `/cook:plan`, `/cook:register`,
    `/cook:status`, `/cook:verify`, `/cook:review` (extension-registered,
    ADR-0007; all paths resolved at invocation from the extension's own
    location — nothing machine-specific is baked in).
  - Optional `agent_settled` loop hardening (re-injects "continue the
    drain" once when the model stops mid-drain).
- `skills/` → symlink to `../skills` (the shared skill set).
- `prompts/` → symlink to `../prompts` (the shared agent prompts).

No build step and no runtime `npm install`: pi loads the TypeScript
directly and provides the `@earendil-works/pi-coding-agent` and `typebox`
imports itself. The `package.json` here is dev-only, for typechecking.

Verified against pi-coding-agent **v0.84.2**.

## Install

Installation is two settings-array entries pointing at this checkout — no
copying, no packaging.

### Global (all projects)

Add to `~/.pi/agent/settings.json` (create it if absent), with the path
adjusted to where you cloned cook. Relative paths in this file resolve
against `~/.pi/agent`; absolute paths and `~` both work:

```json
{
  "extensions": ["~/projects/cook/pi/extension/index.ts"],
  "skills": ["~/projects/cook/pi/skills"]
}
```

If the file already exists, append to the existing `extensions` and
`skills` arrays rather than replacing them.

### Project-local (one repo)

Add to the target repo's `.pi/settings.json`. Relative paths here resolve
against the `.pi` directory itself:

```json
{
  "extensions": ["../../cook/pi/extension/index.ts"],
  "skills": ["../../cook/pi/skills"]
}
```

Note: pi loads project-local settings **only after you trust the project**
(pi asks on first entry, or `defaultProjectTrust` decides headlessly). An
untrusted project silently loads neither entry — if `/cook:drain` is
missing, trust the project first.

### Check it took

Start `pi` and type `/cook:` — the six cook commands should complete. The
drain/plan/register skills carry `disable-model-invocation: true`, so they
are invisible to the model's own initiative by design; the commands are the
only entry points.

## Smoke test

Exercises the sealed-child contract against your real local `pi` binary
(exact seal argv, prompt on stdin, JSONL parse, final-assistant-message
extraction). Needs only bash, `pi`, and node:

```sh
pi/extension/smoke-test.sh
```

Expected output: `SMOKE OK: … -> COOK-SMOKE-OK`. Set `PI_BIN` to test a
non-PATH binary.

To typecheck the extension against pi's real published types:

```sh
cd pi/extension && npm ci && npx tsc --noEmit
```
