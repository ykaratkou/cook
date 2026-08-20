---
description: "Force the cook Reviewer on a task set now, outside the automatic flow. Writes a fresh non-gating review document."
argument-hint: <set-id>
---

Read `${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/references/review.md` and
run its **force mode** for the named set: always write a fresh review,
ignoring the review episode fingerprint. The review gates nothing; report the
review pointer (path, commit, out-of-date flag), never inline the body.
Prompt rendering rules are in
`${CLAUDE_PLUGIN_ROOT}/claude-code/skills/drain/SKILL.md`.

Set to review: $ARGUMENTS
