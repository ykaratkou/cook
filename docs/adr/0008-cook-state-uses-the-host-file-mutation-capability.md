---
status: accepted
date: 2026-08-21
---

# Cook state is read and written through the host's file tools

ADR-0006 made the skills name capabilities and let each host's delivery note
supply the mechanism — but the capability set it covered (subagent spawn,
output capture, structured ask, prompts directory, session id, interrupt) left
out the one the orchestrator exercises every single iteration: reading and
mutating cook's own files. Into that gap the drain skill's ground rule 4 put a
*mechanism* instead of a capability — "a temporary file in the same directory,
then a rename over the target" — which **no file tool on either host
provides**. Both hosts' write/edit tools do an in-place write.

The two hosts therefore diverged in the worst available way. Claude Code
silently disobeyed the rule and mutated state with `Edit`/`Write`, which is
why its drains are quiet. Pi obeyed it literally, and the only way to obey is
`bash` plus a JSON-capable interpreter — so the pi orchestrator authored a
fresh `python3` heredoc per turn to read config, create and refresh
`drain.lock`, and bump a task's `attempts` (observed live, 2026-08-20). A rule
that can only be followed by writing a program gets a program written.

We decided to close the gap the ADR-0006 way: **`docs/spec/10-hosts.md` gains
a cook-state read-and-mutation capability row**, both delivery notes map it
(claude-code: `Read` / `Edit` / `Write`; pi: `read` / `edit` / `write`), and
ground rule 4 keeps only the guarantee it can actually hold — *one write per
transition, and facts that must land together land in one write*. The
prescribed rename is gone. Pi's `edit` takes several disjoint
`{oldText, newText}` replacements in one call, so the "two facts, one write"
requirement is expressible on both hosts; a state mutation is a targeted text
replacement, which needs no parse, no serialize, and no program.

No new pi extension surface. `cook_state` was considered and rejected: it
would have to encode transition or derivation rules in TypeScript, which is
the per-host orchestration logic ADR-0003 rejected, and it would become a
second source of truth beside the orchestrator's own re-derivation (ground
rule 1).

## Consequences

- **Cook gives up write atomicity, deliberately.** A crash inside a host
  tool's write can leave a torn `manifest.json`. Accepted: `drain.lock`
  makes the orchestrator the single writer, pi serializes its own file
  mutations, and the traded-away risk — improvised programs rewriting state
  with no stale-read check — is the larger one. Both hosts' edit tools also
  require the prior read that ground rule 1 already demands. Recorded as a
  marked divergence in `PARITY.md`: pop writes state atomically from Go.
- **Episode fingerprints are literal id lists, and the contract says so.**
  A hash is the one value a model cannot produce by reasoning, so a
  fingerprint specified as one puts an interpreter in the loop every
  iteration. Cook had already seen this: `docs/spec/06-verify.md` pins the
  hash function as "the **identity encoding** — the sorted ids", and the
  drain skill's verify reference follows it. But `docs/spec/01-storage.md`
  and its drift-guarded copy still describe the field as `"<hash>"` and "a
  hash of the sorted ids", so the format contract contradicts the document
  that defines the encoding. We resolve it toward the identity encoding
  everywhere: the value is the sorted done-AFK ids joined literally
  (`"01-first,03-third"`), compared by string equality. It was only ever
  compared for equality, never used as a key or a digest; the literal form
  needs no tool and lets a human read `state.json` and see *why* an episode
  ended. This is a wording fix to the contract, not a semantic change.
- **No prohibition rule ships.** An explicit "never author a program to touch
  cook state" ground rule was considered and dropped (user decision, Q7/Q9):
  the diagnosis is that the model improvised because the rule was
  unfollowable, not because it lacked discipline. Remove the unfollowable
  rule, name the tool, and there is nothing left for a program to do. Ground
  rule 1 stands unchanged as the answer to derivation-by-program.
- **The plan and register skills get the same mapping**, since authoring and
  validating a set are state writes and reads too. The `prompts/` templates
  are untouched: they name no state write, implementers are barred from
  `manifest.json` (`skills/drain/references/attempt.md`), and `09-prompts.md`
  is verbatim-from-pop.

## Considered Options

- **Keep true atomicity and name *that* per host.** Rejected: on both hosts
  the only rename primitive is `bash`, so this blesses the shell dance,
  forfeits the edit tools' stale-read guard, and leaves JSON surgery needing
  an interpreter — the observed behavior, legalized.
- **Atomicity for `manifest.json` only**, tool writes elsewhere. Rejected as
  the worst of both: the mixed rule is harder to follow than either pure
  option, and the manifest is precisely the file whose mutations are most
  frequent.
- **A `cook_state` tool in the pi extension.** Rejected per above (ADR-0003).
  Deferring the decision — "build it if pi still improvises" — was also
  rejected: this doc fix *is* that experiment, and an open option invites a
  future session to build the forbidden thing.
- **Abandon JSON for a line-oriented format**, making every edit
  shell-native. Rejected: `01-storage.md`'s contract is a verbatim pop port,
  drift-guarded each porting session, with sets already on disk; format churn
  costs the port far more than the mechanism gap cost.

## Sources in pop

- pop `CONTEXT.md`: **Agent adapter** (the capability/mechanism seam);
  `docs/adr/0165`, `0166` (capability declaration seams).
- Pi facts verified against pi-coding-agent 0.84.2: built-in tool set
  `read, bash, edit, write, grep, find, ls` (`docs/usage.md`), and `edit`'s
  multi-`edits[]` shape plus its serialized file-mutation queue
  (`dist/core/tools/edit.js`).
- User decisions at the state-capability grill (2026-08-21), Q1–Q10.
