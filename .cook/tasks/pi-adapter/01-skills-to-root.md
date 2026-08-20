# Move the shared skills to a repo-root skills/ directory

## Parent
`spec.md` in this set; `docs/adr/0006`; layout in `docs/spec/10-hosts.md`
(this task changes the checkout layout — the spec diagram itself is updated
later by task 06).

## What to build

Make the skill files a single canonical copy at the repo root, shared by
both hosts through symlinks — the same shape `prompts/` already has.

1. `git mv claude-code/skills skills` (the whole tree: `drain/`, `plan/`,
   `register/`, each with its `references/`).
2. Create `claude-code/skills` as a **relative** symlink to `../skills`.
3. Create the pi side: directory `pi/` with `pi/skills` → `../skills` and
   `pi/prompts` → `../prompts`, both relative symlinks.
4. Verify nothing referenced the old physical path in a way symlinks do not
   satisfy: grep the repo for `claude-code/skills` and check each hit still
   resolves (the claude-code command files may keep referencing
   `claude-code/skills/...` — that path now goes through the symlink and
   must still read correctly with `cat`).
5. Do not edit skill file contents in this task (that is task 02), except
   nothing — pure move plus links.

## Acceptance criteria

- [x] `skills/drain/SKILL.md`, `skills/plan/SKILL.md`,
      `skills/register/SKILL.md` exist as regular files at the repo root,
      with their `references/` intact.
- [x] `claude-code/skills`, `pi/skills`, and `pi/prompts` are relative
      symlinks (`ls -l` shows `-> ../skills` / `-> ../prompts`), and
      `cat claude-code/skills/drain/SKILL.md` and
      `cat pi/prompts/implementer.md` both succeed.
- [x] `git status` shows the moves as renames plus three new symlinks; no
      skill file content changed (`git diff --stat` shows no content edits
      to `*.md` under the moved tree).
- [x] Every repo file that mentions a `claude-code/skills/` path still
      resolves through the symlink (checked by reading each grepped path).
