---
status: accepted
date: 2026-10-30
---

# opencode installs the repo root as its package

ADR-0014 made one opencode v2 plugin the adapter, living in `opencode/` with
its own `package.json`. The only install route was a checkout: point
opencode's `plugins` array at `<checkout>/opencode`, run `npm ci` there, and
`git pull` to update. A git-spec install (`opencode plugin add` with a
subpath to `opencode/`) did not work. npm installs only the subfolder, so the
plugin could not reach the repo-root `skills/`, `prompts/`, and
`conventions/` it serves. Claude Code installs cook from GitHub through its
marketplace; opencode has no marketplace, so the gap left opencode users on a
hand-maintained checkout.

We decided **the repo root is the opencode package** (user decision,
2026-10-30). `package.json` and `package-lock.json` move from `opencode/` to
the root. The root `package.json` exports `./opencode/index.ts`, and its
`files` list packs the plugin entry, its commands, and the shared `skills/`,
`prompts/`, and `conventions/`. A git spec with no subpath now installs all
of it, and the plugin's existing lookup (the cook root is its own
directory's parent) finds the shared copy beside it. The adapter code does
not change.

## Consequences

- **Install from GitHub.** `opencode plugin add github:ykaratkou/cook`
  installs the plugin and its dependencies, and writes the spec into the
  global config. `opencode plugin update` moves an unpinned spec to the
  newest commit; a full commit hash pins it.
- **A checkout still works, from the same path.** The `plugins` entry still
  names `<checkout>/opencode`: opencode 2.0.20 loads a local plugin directory
  from its `index.ts` and ignores `package.json` `exports`, so naming the
  checkout root loads nothing. Only `npm ci` moves, to the checkout root,
  where Bun finds the dependencies from `opencode/`. Developing against a
  checkout stays the same single step.
- **The smoke script's git-spec check becomes a pass/fail check.** It
  installs the committed `HEAD` through `git+file://` into an isolated
  opencode home and fails unless the installed plugin reaches `skills/`,
  `prompts/`, and `conventions/`.
- **Claude Code is unaffected.** It ignores `package.json`, and its plugin
  root was already the repo root (doc 10).
- **The `files` list is the opencode payload.** A new repo-root directory the
  plugin reads at runtime must be added to it, or git-spec installs ship
  without it while checkout installs keep working.

## Considered Options

- **Keep the checkout as the only route.** Rejected: every update is a manual
  `git pull`, and opencode runs whatever the checkout holds, unpushed work
  included.
- **A second `package.json` at the root, keeping `opencode/package.json` for
  checkouts.** Rejected: two copies of the `@opencode/plugin` pin and two
  lockfiles to keep in step.
- **Copy or symlink the shared directories into `opencode/`.** Rejected: a
  copy breaks the single shared copy (doc 10), and npm does not follow
  symlinks out of a packed subfolder.
- **Wait for opencode to keep the repo root on a subpath install.** Rejected:
  nothing in opencode 2.0.20 or its V2 docs points that way, and the root
  package needs no opencode change.

## Sources

- User decision, 2026-10-30: install the opencode plugin from GitHub.
- opencode v2.0.20 as installed: an isolated `opencode plugin add` of a
  `git+file://` spec for this layout installed the repo root and registered
  the six `cook:` commands and eight `cook/` skills. A checkout-path entry
  naming the repo root loaded nothing, while one naming `opencode/` (with the
  dependencies at the root) loaded all of them. The V2 plugin docs
  (https://opencode.ai/v2/docs/plugins) for git specs, `::path:` subpaths,
  and `plugin update`.
- Cook ADR-0014 (the adapter, amended here on install routes).
