# Sync the spec set, parity ledger, and pi install README

## Parent
`spec.md` in this set (Implementation Decisions: spec edits carried by this
set); `docs/adr/0006`, `docs/adr/0007`; `PARITY.md` drift-guard checklist;
grill decisions Q4 (timeout stays Blind), Q7 (docs updated in-set), Q8
(settings-array install).

## What to build

Bring the binding docs in line with what tasks 01–05 shipped, and write the
pi install README. The repo is docs-first: after this task, a reader of the
spec set finds no statement the implementation contradicts.

1. **`docs/spec/10-hosts.md`**:
   - Slash-command row and "pi specifics": commands are
     extension-registered (`pi.registerCommand`), namespaced identically to
     claude-code (`/cook:drain` … — or the recorded fallback names from
     task 04), replacing "prompt templates named for the cook verbs";
     point at ADR-0007.
   - Headless-child-sealing row: add `--no-prompt-templates`; note the
     prompt travels via stdin, never argv.
   - Per-host layout diagram: repo-root `skills/` with `claude-code/skills`
     and `pi/skills` symlinks; `pi/extension/`; drop the pi
     `prompts → symlink or build-copy` alternative in favor of the shipped
     symlink.
   - pi specifics: name the shipped tools (`cook_subagent`, `cook_gate`),
     the runtime path injection, and the delivery notes
     (`skills/drain/references/host-*.md`).
   - Timeout kill stays **Blind** with the existing Revisit note (do not
     flip it).
2. **`docs/adr/0003`**: append a short "Superseded on one point" note (or
   status amendment) marking the "`/cook` resolves unnamespaced on both
   hosts" sentence superseded by ADR-0007; do not rewrite history.
3. **`PARITY.md`**: update the drift-guard checklist's format-contract copy
   path (`skills/register/references/format-contract.md`), and sweep other
   repo docs (`CONTEXT.md` untouched unless a term changed) for stale
   `claude-code/skills/` canonical-path mentions — symlinked paths that
   still resolve may stay where they describe the claude-code host
   specifically.
4. **`pi/README.md`**: what the adapter is, and the install: the exact
   `extensions` and `skills` entries to add to `~/.pi/agent/settings.json`
   (paths resolve relative to `~/.pi/agent`; absolute and `~` supported) or
   a project's `.pi/settings.json` (relative to `.pi`), pointing at this
   checkout; a note that project-local loading requires project trust; and
   the smoke-test invocation.
5. Anything discovered during tasks 01–05 that contradicts the spec and is
   not covered above: fix the doc or record the divergence — leave no
   silent drift.

## Acceptance criteria

- [x] `docs/spec/10-hosts.md` describes the shipped pi adapter accurately:
      extension-registered namespaced commands, the two tool names, the
      stdin-prompt seal including `--no-prompt-templates`, the root
      `skills/` layout, and timeout kill still Blind.
- [x] ADR-0003 carries the supersession note pointing at ADR-0007.
- [x] `PARITY.md`'s drift-guard names the new format-contract path, and
      `grep -rn "claude-code/skills" docs/ PARITY.md` returns only hits
      that are correct as written.
- [x] `pi/README.md` exists with copy-pasteable settings entries for both
      global and project install and the smoke-test command.
