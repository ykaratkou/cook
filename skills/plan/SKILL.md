---
name: plan
description: Author a cook task set for a feature by orchestrating the companion skills grill-with-docs, to-spec, and to-tickets, then self-validating until the set derives READY. Loaded by the /cook:plan command.
user-invocable: false
disable-model-invocation: true
---

# Plan: author a task set

`/cook:plan <feature>` takes one feature from idea to a READY task set under
`.cook/tasks/<set-id>/`. The human touches the flow here (the interview) and
at the end (confirming the set); the decomposition in between follows the
companion skills.

## Companion skills — required, not shipped

Plan orchestrates three skills cook depends on but does not ship:

1. **grill-with-docs** — the design interview; produces decision records
   (ADRs, glossary entries).
2. **to-spec** — turns the settled decisions into a spec document.
3. **to-tickets** — decomposes the spec into tickets/tasks.

Before starting, check each is available (installed skills; both hosts read
`~/.agents/skills/`). **If one is missing, stop and say which skill to
install** — do not improvise a substitute interview, spec, or decomposition.
Hand-authoring against the format contract plus `/cook:register` remains the
fallback the human can always use.

## Procedure

1. **Interview** — run grill-with-docs on the feature.
2. **Spec** — run to-spec on the settled decisions.
3. **Decompose** — run to-tickets, pointing it at cook's store via the
   adapter doc [references/issue-tracker.md](references/issue-tracker.md), so
   it publishes a cook-shaped set. Requirements for the result:
   - a `<set-id>`: lowercase kebab-case slug, unique under `.cook/tasks/`;
   - small **vertical-slice AFK tasks**, each self-containedly implementable
     by a fresh-context agent, each with at least one checkbox under
     `## Acceptance criteria`;
   - a single **terminal HITL sign-off task**, blocked by every AFK task in
     the set (the canonical shape); HITL tasks contain only human work;
   - `blocked_by` capturing real prerequisites; manifest order as the
     authored sequence;
   - optional planned `commit_subject` per task; the planning spec co-located
     as `spec.md` (context only);
   - `manifest.json` per the format contract.
4. **Self-validate** — apply the register skill's validation
   (`../register/SKILL.md` with its
   [format contract](../register/references/format-contract.md)) and fix
   faults until the set derives **READY**. Do not present a set that does
   not validate.
5. **Report** — the set id, the task listing (type, blocked_by), and the next
   step: `/cook <set-id>` to drain.

The format contract is authoritative for every file written here — when this
skill and the contract seem to disagree, the contract wins.

## Sources

`docs/spec/00-overview.md` (the plan front door), `docs/spec/01-storage.md`
(the contract), `docs/spec/10-hosts.md` (companion skills, adapter doc) in
the cook repository; pop sources in their footers.
