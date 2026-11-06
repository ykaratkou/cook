---
name: auto-grill
description: Delegate open domain-modeling questions to a read-only answerer; apply supported answers and escalate judgement calls.
argument-hint: [optional hints, e.g. "treat edge-snap as one idea"]
disable-model-invocation: true
---

Use the open questions from your previous message in the domain-modeling session.

1. Build a handoff for an agent without conversation history:
   - the repo path;
   - the user's original request, verbatim;
   - each settled decision (one line each), including those not yet in GLOSSARY.md;
   - each open question verbatim, numbered, with your recommendation and cited code facts;
   - user hints from `$ARGUMENTS` or the invoking message, if supplied.
2. Read [ANSWERER.md](ANSWERER.md) on each run. Use the runtime's delegation tool and general-purpose agent with its default model. Honor an explicit user model/provider choice using runtime discovery; otherwise omit model overrides. Do not hard-code provider, model, tool, or agent identifiers. If delegation is unavailable, report the missing capability and stop. Give the agent the full ANSWERER.md text, then `=== HANDOFF ===`, then the handoff. Restrict it to repository reads and web research using runtime permissions where supported.
3. Log the returned report before applying answers, for later evaluation:
   - Create `~/.local/state/auto-grill/runs/<YYYYMMDD-HHMMSS>-<repo dir name>/`.
   - Write `handoff.md` (the exact text after `=== HANDOFF ===`) and `answers.md` (the agent's report, verbatim).
   - Copy `GLOSSARY.md` (or `GLOSSARY-MAP.md` and the glossaries it lists) and `docs/adr/` into `context/` there, if they exist.
4. Apply answers:
   - Treat ANSWERED answers as user replies: update GLOSSARY.md and continue domain-modeling.
   - Leave JUDGEMENT answers unapplied until the user confirms or corrects them.
   - If no answers are JUDGEMENT, continue without confirmation.
   - End with one line per question, in order: an answer of at most 5 words, `✓` for applied or `?` for JUDGEMENT, and what would change a JUDGEMENT answer in at most 5 words. Keep URLs, sources and notes in the run log:
     ```
     Q1 ✓ TypeSafe: decision-model API
     Q3 ✓ Token in Keychain
     Q5 ? Leave Voice out · unless same release
     ```
5. After confirmation, continue with the next batch of terms.

To tune [ANSWERER.md](ANSWERER.md) against recorded runs, see the eval runner's docstring in `evals/run.py`.
