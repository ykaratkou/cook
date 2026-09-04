#!/usr/bin/env bash
#
# Re-sync the vendored companion skills with upstream mattpocock/skills.
#
# This is the procedure in PROVENANCE.md, executable: it takes the
# upstream side wholesale, updates the provenance record, and reports what
# moved. It only ever writes to the working tree — staging, committing, and
# opening the pull request belong to the caller (see
# .github/workflows/resync-vendored-skills.yml, which runs this daily).
#
# Run it by hand the same way:  .github/scripts/resync-vendored-skills.sh
#
# Outputs (for the workflow): `changed`, `upstream_commit`, `upstream_version`
# appended to $GITHUB_OUTPUT when set. The commit message and PR body are
# written to $SUMMARY_DIR (default: the repo root, as .resync-*.md, ignored).

set -euo pipefail

UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/mattpocock/skills.git}
PROVENANCE=PROVENANCE.md
LICENSE_COPY=LICENSE-mattpocock-skills

# upstream path : vendored directory name. The five are the dependency closure
# of /cook:plan; adding a sixth means editing this list and PROVENANCE.md.
PAIRS=(
  "engineering/grill-with-docs:grill-with-docs"
  "productivity/grilling:grilling"
  "engineering/domain-modeling:domain-modeling"
  "engineering/to-spec:to-spec"
  "engineering/to-tickets:to-tickets"
)

cd "$(git rev-parse --show-toplevel)"
SUMMARY_DIR=${SUMMARY_DIR:-$PWD}

emit() { # name value
  [[ -n ${GITHUB_OUTPUT:-} ]] && printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"
  printf '%s=%s\n' "$1" "$2"
}

recorded_commit=$(grep -oE '\b[0-9a-f]{40}\b' "$PROVENANCE" | head -1)
if [[ -z $recorded_commit ]]; then
  echo "error: no 40-char upstream commit recorded in $PROVENANCE" >&2
  exit 1
fi

clone=$(mktemp -d)
trap 'rm -rf "$clone"' EXIT
git clone --quiet --filter=blob:none "$UPSTREAM_URL" "$clone"

upstream_commit=$(git -C "$clone" rev-parse HEAD)
upstream_version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$clone/package.json")

echo "recorded: $recorded_commit"
echo "upstream: $upstream_commit (v$upstream_version)"

# Take the upstream side wholesale. --delete so an upstream deletion lands
# here too; --exclude agents because the installer metadata is not vendored.
for pair in "${PAIRS[@]}"; do
  src="$clone/skills/${pair%%:*}/"
  dst="skills/${pair##*:}/"
  if [[ ! -d $src ]]; then
    echo "error: upstream no longer has ${pair%%:*} — re-sync by hand and update $PROVENANCE" >&2
    exit 1
  fi
  mkdir -p "$dst"
  rsync -a --delete --exclude 'agents' "$src" "$dst"
done
cp "$clone/LICENSE" "$LICENSE_COPY"

targets=("$LICENSE_COPY")
for pair in "${PAIRS[@]}"; do targets+=("skills/${pair##*:}"); done

# Against HEAD, not the index: a staged-but-uncommitted vendored change is
# still a change. Untracked files are checked separately — git diff misses them.
if git diff --quiet HEAD -- "${targets[@]}" &&
   [[ -z $(git ls-files --others --exclude-standard -- "${targets[@]}") ]]; then
  echo "IN SYNC: the vendored copies already match upstream $upstream_commit"
  emit changed false
  emit upstream_commit "$upstream_commit"
  emit upstream_version "$upstream_version"
  exit 0
fi

# Only a real copy advances the provenance record: the commit, version, and
# date describe when files were last taken from upstream, not when we looked.
python3 - "$PROVENANCE" "$upstream_version" "$upstream_commit" "$(date -u +%Y-%m-%d)" <<'PY'
import pathlib, re, sys
path, version, commit, today = sys.argv[1:5]
p = pathlib.Path(path)
s = p.read_text()
s, n_v = re.subn(r'(\*\*Copied from\*\*: tag/version `)[^`]+(`)', rf'\g<1>{version}\g<2>', s, count=1)
s, n_c = re.subn(r'\b[0-9a-f]{40}\b', commit, s, count=1)
s, n_d = re.subn(r'(\*\*Copy date\*\*: )\d{4}-\d{2}-\d{2}', rf'\g<1>{today}', s, count=1)
if not (n_v and n_c and n_d):
    sys.exit(f"error: {path} no longer has the version/commit/date fields this script updates "
             f"(matched version={n_v} commit={n_c} date={n_d})")
p.write_text(s)
PY

diffstat=$(git diff --stat -- "${targets[@]}" "$PROVENANCE")
untracked=$(git ls-files --others --exclude-standard -- "${targets[@]}")
upstream_paths=()
for pair in "${PAIRS[@]}"; do upstream_paths+=("skills/${pair%%:*}"); done
if git -C "$clone" merge-base --is-ancestor "$recorded_commit" "$upstream_commit" 2>/dev/null; then
  log=$(git -C "$clone" log --no-merges --format='- %h %s' \
          "$recorded_commit..$upstream_commit" -- "${upstream_paths[@]}" LICENSE)
  [[ -z $log ]] && log="- (none — upstream moved, but not in the vendored paths, so this diff is a
  local edit being reverted; the verbatim rule forbids those, ADR-0010)"
else
  log="- (upstream HEAD is not a descendant of the recorded commit: a rewritten
  history, a moved default branch, or a downgrade. Read the diff with that in
  mind before merging.)"
fi

cat >"$SUMMARY_DIR/.resync-commit-message" <<EOF
chore(skills): re-sync the vendored companion skills

Upstream mattpocock/skills is at v$upstream_version, commit
$upstream_commit. Take the upstream side wholesale and
advance the provenance record, per PROVENANCE.md.

Upstream commits touching the vendored paths:

$log
EOF

cat >"$SUMMARY_DIR/.resync-pr-body.md" <<EOF
Daily upstream check found the vendored companion skills out of date. This
branch takes the upstream side wholesale and advances the provenance record
— the procedure in \`PROVENANCE.md\`, run by
\`.github/workflows/resync-vendored-skills.yml\`.

The branch is machine-owned: the daily run rebuilds it from the default
branch and force-pushes, so review edits belong in a follow-up commit after
merge, not here.

| | |
| --- | --- |
| Upstream | [mattpocock/skills](https://github.com/mattpocock/skills) |
| Recorded before | \`$recorded_commit\` |
| Now | \`$upstream_commit\` (v$upstream_version) |

**Upstream commits touching the vendored paths**

$log

**What changed here**

\`\`\`
$diffstat
\`\`\`
${untracked:+
New files: $untracked
}
**Before merging**

- [ ] Read the diff. These are copies cook redistributes; a change lands in
      every install of \`/cook:plan\`.
- [ ] Check \`skills/plan/SKILL.md\`'s procedure still describes what the
      companions do (interview → spec → tickets), and that the
      issue-tracker adapter doc still overrides whatever tracker the copies
      name. An adaptation cook needs goes in the plan skill or the adapter
      doc, never in a vendored file (ADR-0010).
- [ ] Check upstream's license is still MIT: \`$LICENSE_COPY\` is part of
      this diff whenever it changes.
EOF

echo "CHANGED:"
echo "$diffstat"
emit changed true
emit upstream_commit "$upstream_commit"
emit upstream_version "$upstream_version"
