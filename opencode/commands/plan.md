---
description: "Author a cook task set for a feature: interview (grill), spec, decompose into tickets, then self-validate until the set derives READY."
---

Read `${COOK_ROOT}/skills/plan/SKILL.md` in full and follow it. It
orchestrates the companion skills (grilling → to-spec → to-tickets),
drafting the interview's ADRs and glossary changes inside the set, and
self-validates the resulting task set against the format contract until
it derives READY.

On opencode the companion skills are registered under the `cook/` prefix:
load them with the `skill` tool as `cook/grilling`, `cook/to-spec`, and
`cook/to-tickets`. Never load `cook/grill-with-docs` or
`cook/domain-modeling` for the interview: both write into the repository.

Your host's delivery note is
`${COOK_ROOT}/skills/drain/references/host-opencode.md` (opencode); apply it
wherever the skill names a capability.

Feature to plan: $ARGUMENTS
