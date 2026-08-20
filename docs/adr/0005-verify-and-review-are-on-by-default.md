---
status: accepted
date: 2026-08-20
---

# Verify and review are on by default

Pop gates Agent verification behind user config, off by default, and code
review is a separate opt-in phase. Cook flips both defaults: **verify and
review are ON** in `.cook/config.json`, because the user judged automatic
verification half the reason to want this feature at all — an attended drain
whose finished work nobody checked is a weaker product than pop, not a port
of it.

The automatic tail of every drain is therefore:

1. When no open AFK work remains, the **Verifier** runs (fresh-context
   subagent, judging done AFK work against acceptance criteria over the set's
   commit range).
2. **Disposition**: PASS → cached for the episode, continue. FIXABLE → a
   **Remediation task** is auto-spawned carrying the findings, the cached
   verdict is invalidated, and the drain loops back to pick it up — bounded by
   the remediation depth cap, after which the set parks at the Verify-failed
   gate. NEEDS-HUMAN → the Verify-failed gate opens directly.
3. After a PASS, the **Reviewer** runs and writes the review document into the
   set directory. **Review never gates** — whatever it says, the flow
   continues; the document is pointed to at the HITL sign-off gate for the
   human to read before signing off.
4. On a set with a pending HITL sign-off, verification runs *before* the gate
   opens — cheap agent checking precedes expensive human time (pop's rule,
   kept verbatim).

The divergence from pop's defaults is recorded in `PARITY.md` as a marked
default change, not a semantic one: the flows themselves are pop's.

## Sources in pop

- `tasks/verify.go`, `tasks/verify_phase.go`, `tasks/review.go`,
  `tasks/review_phase.go`
- pop `CONTEXT.md`: **Agent verification** ("gated by user config, off by
  default" — the default cook flips), **Verify verdict**, **Remediation
  task**, **Verification invalidation**, **Verification idempotency after
  PASS**
