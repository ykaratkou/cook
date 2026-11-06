---
status: accepted
date: 2026-11-04
---

# Plan and Map stops end with a `Cook-Stop:` line

`/cook:plan` and `/cook:map` stop in plain text whenever they wait for the
human: a grilling round, grilling's shared-understanding check, to-spec's
seams check, to-tickets' breakdown quiz, and on a Map the handoff, blocked
ticket, prototype and checklist asks. A human reads which one it is. A
program driving the session (an orchestrator runs `/cook:plan` and
`/cook:map` under `claude -p`, `opencode serve` and `codex exec`) cannot: it would have to
guess the stop from prose that the vendored skills word differently every
time. A driven plan whose stop is not recognised stalls on a human, even when
the next step was meant to be automatic (an auto-grill of a questions round,
an agent's review of the breakdown).

We decided **every plain-text plan and Map stop ends with a last line
`Cook-Stop: <kind>`** (user decision, 2026-11-04, from the orchestrator's
own-kanban Map, ticket "Cook changes for driven runs").

- The format is `^Cook-Stop: [a-z-]+$`, the turn's last line. The kinds are
  `questions`, `confirm`, `seams`, `breakdown`, and on Maps also
  `ticket-blocked`, `handoff-confirm`, `prototype`, `checklist`.
  Amended 2026-11-06 (ADR-0020): `judgement`, which auto-grill ends with when
  it leaves judgement calls open, in a plan, a Map, or any other session.
- It is always on, interactive or driven: one rule, no mode to detect.
- The rule lives in cook's own `skills/plan/SKILL.md` and
  `skills/map/SKILL.md` ("Stops"), which every host's plan and map entry
  points load, Codex's `codex/skills/` wrappers included. The vendored grilling, to-spec,
  to-tickets and wayfinder copies stay byte-intact (ADR-0010).
- The contract for drivers is `docs/spec/10-hosts.md`, "Stop markers".
- The drain gets no marker: its gates are already structured asks, and its
  other states derive from files.

The same ticket settled one decision-drafts clause: a delegate the human
invokes to answer the interview for them (such as an auto-grill skill) is the
human answering, its judgement calls stay open for the human, and it writes
only drafts (`skills/plan/references/decision-drafts.md`, doc 01).

## Considered Options

- **Structured asks for plan stops** (AskUserQuestion, opencode's `question`
  tool, Codex's `request_user_input`), as the drain's gates do. Rejected: a grilling round is several
  open-ended questions with recommendations, which a choice form flattens;
  and it would mean editing the vendored skills.
- **A checkpoint file** naming the current step. Rejected: a second record
  to keep in step with the turn, written by an agent that may forget it; the
  turn's own text is where the stop already is.
- **Marker only when driven.** Rejected: nothing in the session reliably
  says it is driven, and a line a human can ignore costs nothing.

## Consequences

- A driver reads a turn's stop from its last line, and treats a turn with
  none as a report or an ask outside the contract.
- Humans see one extra line at each stop in an interactive session.
- The marker is an instruction to the model, not enforced: a turn that
  forgets it reads as unmarked, and the driver falls back to showing the
  human the raw text.
- A new plain-text stop in either skill must add its kind here, in the
  skill's Stops table, and in doc 10.

## Sources

- Cook ADR-0004 (attended-only v1), ADR-0010 (vendored companions), ADR-0017
  (Map), ADR-0018 (decision drafts); docs 01, 08, 10, 11.
