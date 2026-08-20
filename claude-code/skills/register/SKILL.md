---
name: register
description: Validate a cook task set (hand-authored or hand-edited) against the format contract; print the ordered fix list or READY. Loaded by the /cook:register command; also the format authority other cook skills defer to.
user-invocable: false
---

# Register: validate a task set

`/cook:register <set-id>` validates the set at `.cook/tasks/<set-id>/`
against the format contract and reports either **READY** (or the set's actual
derived status, when valid) or the **fix list**. Registration is read-only:
it never drains, never spawns anything, and never edits the set on its own —
fixing is the human's (or their drafting agent's) work, re-validated by
running register again.

The contract itself — layout, `manifest.json`, task-file shape, journal,
`state.json`, config, and the validation rules — is
[references/format-contract.md](references/format-contract.md), a verbatim
copy of the cook spec's contract section. Read it in full before validating;
it is authoritative for file shape everywhere in cook (gate drafts and
remediation spawns follow it too).

## Procedure

1. Read [references/format-contract.md](references/format-contract.md).
2. Apply its **Validation rules (register)** section, in order, to the set
   directory. Collect every fault, not just the first.
3. Classify each fault as the contract does: **errors** make the set
   MALFORMED (it will not drain); the rules marked as warnings warn only
   (unknown manifest keys; a HITL task whose body describes software to
   build — name the typing rule).
4. Report:
   - Errors present → print the fix list, ordered by rule number, each entry
     naming the file, the rule violated, and the concrete fix. State that
     the set is MALFORMED and will not drain until the list is clear.
   - No errors → print warnings (if any), then the set's derived status
     (usually READY; derive it per the drain skill's
     `../drain/references/status.md`) and the open-task listing.

Never "helpfully" repair files during validation. When the human asks you to
fix a fault, do it as a normal edit outside this procedure, then re-run the
validation from the top.

## Sources

`docs/spec/01-storage.md` in the cook repository (pop sources in its footer);
the embedded contract copy is checked against it by `PARITY.md`'s
drift-guard.
