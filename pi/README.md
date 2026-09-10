# Cook on pi

This directory is cook's [pi](https://github.com/earendil-works/pi) host
adapter: one TypeScript extension plus symlinks into the shared core.
Everything cook *is* — the skills, the prompts, the storage contract — lives
at the repo root and is host-neutral; this adapter only supplies the pi
mechanisms those skills name (see `docs/spec/10-hosts.md` and
`skills/drain/references/host-pi.md`).

**Cook does not implement subagents on this host.** That capability comes
from [`@tintinweb/pi-subagents`](https://github.com/tintinweb/pi-subagents),
a prerequisite package (ADR-0011) — see **Prerequisite** below.

- `extension/index.ts` — the whole adapter. Registers:
  - **`cook_gate`** — structured gate asks over `ctx.ui`
    (select / confirm / input); errors instead of defaulting when the
    session has no UI (gates are attended-only, ADR-0004).
  - The six commands: `/cook:drain`, `/cook:plan`, `/cook:register`,
    `/cook:status`, `/cook:verify`, `/cook:review` (extension-registered,
    ADR-0007; all paths resolved at invocation from the extension's own
    location — nothing machine-specific is baked in).
  - Optional `agent_settled` loop hardening (re-injects "continue the
    drain" once when the model stops mid-drain).
  - A once-per-session probe for the prerequisite, which warns with the
    install command when pi-subagents is not active.
- `skills/` → symlink to `../skills` (the shared skill set: cook's drain,
  plan, and register skills plus the five vendored companion skills
  `/cook:plan` orchestrates — see `PROVENANCE.md` at the repo root).
- `prompts/` → symlink to `../prompts` (the shared agent prompts).

No build step and no runtime `npm install` of our own: pi loads the
TypeScript directly and provides the `@earendil-works/pi-coding-agent` and
`typebox` imports itself. The `package.json` in this directory is dev-only,
for typechecking; the one at the repo root is the **pi package manifest**
(`pi.extensions` / `pi.skills`), which is what makes the git install below
work.

Verified against pi-coding-agent **v0.84.2** and pi-subagents **v0.19.0**.

## Prerequisite

```sh
pi install @tintinweb/pi-subagents
```

Every Attempt, Verifier and Reviewer run is one `Agent` call against that
package, made with `subagent_type: "general-purpose"`, `isolated: true` and
`run_in_background: false` — the seal and the inline result, respectively
(`skills/drain/references/host-pi.md` is the full mapping). Without it,
`/cook:drain`, `/cook:verify` and `/cook:review` cannot run; cook warns once
per session rather than failing, because `/cook:status` and `/cook:register`
spawn nothing and work regardless.

Cook does not bundle it: it is useful on its own, most pi users already have
it, and a bundled copy would load twice for them.

## Install

### From GitHub (pi package — the usual way)

```sh
pi install git:github.com/ykaratkou/cook
```

That writes a `packages` entry into `~/.pi/agent/settings.json` and clones
under `~/.pi/agent/git/`. Use `-l` to install into the current project's
`.pi/settings.json` instead (teammates then get it auto-installed on first
trusted start). Pin a ref with `@`:

```sh
pi install git:github.com/ykaratkou/cook@<tag-or-sha>
```

To try it without installing: `pi -e git:github.com/ykaratkou/cook`.

The root manifest loads exactly the extension (`pi/extension/index.ts`) and
the shared `skills/`; the shared `prompts/` directory is deliberately **not**
exposed as prompt-template commands — those files are cook's internal
subagent prompts, which the extension resolves by path at runtime.

### From a local checkout (settings arrays — for hacking on cook)

Two settings-array entries pointing at your clone — no copying, no
packaging.

#### Global (all projects)

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

#### Project-local (one repo)

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
only entry points. The vendored companion skills (`grill-with-docs`,
`grilling`, `domain-modeling`, `to-spec`, `to-tickets`) load from the same
directory and keep upstream's frontmatter, so `/skill:grill-with-docs` and
friends resolve — that is what `/cook:plan` relies on.

## Watching a run

pi-subagents owns this: its live widget shows a running agent, `/agents` and
FleetView list them, and each run leaves an `.output` transcript under the
session directory. Cook produces none of it and reads none of it — a trace is
the host's artifact (`docs/spec/10-hosts.md`, ADR-0009), so deleting every one
changes nothing cook would decide.

## Smoke test

Cook depends on another project's output format: the delivery note tells the
orchestrator that a foreground `Agent` result is a stats header, a blank
line, then the subagent's reply, and cook's core reads a Verifier's
`VERDICT:` as that reply's first line. This pins the framing against your
real `pi` and your real installed pi-subagents:

```sh
pi/extension/smoke-test.sh
```

Expected output: `SMOKE OK: header + blank line + reply -> COOK-SMOKE-OK`.
Exit 2 means pi-subagents was not found — set `PI_SUBAGENTS_ENTRY`, or
`PI_BIN` for a non-PATH pi.

## Typechecking

To typecheck the extension against pi's real published types:

```sh
cd pi/extension && npm ci && npx tsc --noEmit
```
