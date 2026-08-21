---
status: accepted
date: 2026-08-21
---

# A host capability the human reads is declared Human-facing

The capability matrix declares each capability **Supported** (cook may rely on
it, with the named mechanism) or **Blind** (cook must not rely on it; the
spec'd behavior stays dormant until a host can enforce it). Both values
describe what cook's *logic* may do with a host affordance.

The matrix also lists affordances no cook logic reads at all, and it has been
declaring those Supported. The loop-hardening row is the proof: **Supported**
on both hosts since it was written, and followed immediately by a section —
"Loop hardening is optional, correctness is not" — stating that correctness
never depends on it. A reader who trusts the declaration and a reader who
continues to the next section learn different things. Adding a row for
subagent trace visibility, which no skill reads, no status derives from, and
no gate consults, would have made two such rows and set the pattern.

We decided the declaration pattern gains a third value: **`Human-facing` — the
capability's audience is the human, and no cook logic may rely on it.** It is
not a weaker Supported and not a milder Blind. Blind is a *loss*: it carries
the reason, so a human can see what the host would need, and the spec'd
behavior waits for a host that can enforce it. Human-facing is not a loss —
nothing depending on it is the correct design, and there is no host gap to
close. Naming the audience is what separates the value: the other two say what
cook may do, this one says who is looking.

Consequence: the loop-hardening row's declaration changes from **Supported** to
**Human-facing** on both hosts, and the "Loop hardening is optional,
correctness is not" section stands unchanged — it now agrees with its own row.
The subagent trace visibility row is Human-facing from birth. `PARITY.md`
carries the divergence from pop's two-value pattern, plus a drift-guard item,
because a vocabulary with no check rots back into "everything is Supported".
No ADR is superseded: no ADR ever declared the hardening row Supported, so
there is no earlier decision to correct.

Delivery notes gain nothing from a Human-facing row. ADR-0006 defines a
delivery note as mapping each capability **the skill names** to that host's
mechanism, and a capability no cook logic reads is a capability no skill names.
That the value tells an author not to write those two files is the point of
having it.

## Considered Options

- **Declare subagent trace visibility Supported.** Rejected: cook must never
  rely on it, and separating what cook may rely on from what it may not is the
  matrix's only job — spending that distinction on a human's viewing
  convenience leaves the matrix unable to make it.
- **Omit the row and describe the trace in prose only.** Rejected: the matrix
  is the host-comparison table a reader consults first; a capability that
  exists on both hosts and is missing from it reads as missing from cook.
- **Name the value Advisory or Informational.** Rejected: audience, not advice,
  is the distinction being drawn. Nothing consults a Human-facing capability,
  so "advisory" overstates it, and every row is informational to a reader.
- **Apply the new value to new rows only, leaving loop hardening Supported.**
  Rejected: a vocabulary whose first act is to exempt the row that motivated it
  does not survive one porting session.

## Sources in pop

- pop's adapter-capability declaration pattern: ADR-0165, ADR-0166 (capability
  declaration seams), ADR-0190 (a Blind declaration names its reason).
- Cook ADR-0006 (skills name capabilities, hosts supply delivery notes) and
  ADR-0008 (the precedent for one change adding a capability row with its spec
  and parity edits).
- User decisions at the trace-visibility grill (2026-08-21), Q1-Q10.
