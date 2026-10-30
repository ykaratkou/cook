# Cook

Cook is an in-agent plugin (Claude Code, opencode) that ports pop's task-set
implement feature: the drain with its nested loops, the verification tail, the
remediation loop, the Refine pass, and the human gates. This glossary
imports pop's terms verbatim; a term defined here means what it means in pop
unless the entry says otherwise.

## Vocabulary rule

The word **"ralph" stays out of cook's vocabulary**, for the same reason pop
banned it (pop ADR-0190): the community uses it for a self-repeating outer
loop, and importing it would blur which of cook's nested loops is meant. Alias
note for findability: what the community calls a *Ralph loop* is cook's
**Drain**.

## Language

### Work and its shape

**Task set**:
A named collection of tasks that together deliver one vertical slice of work,
stored as one directory of files. The unit a Drain runs over.
_Avoid_: ticket batch, PRD, issue list, ralph list

**Task manifest**:
The single authoritative record of a Task set's tasks and their current
statuses. It is State: true now, overwritten on change, holding no history.
_Avoid_: index, task list file

**AFK task**:
A task containing only agent-doable work — build, refactor, test. The only
kind of task a Drain executes.
_Avoid_: auto task, agent task

**HITL task**:
A task containing only human work — verification, decisions, manual checks,
sign-off. Never executed by an agent; it surfaces as a gate. Agent-doable prep
belongs in a separate AFK task the HITL task is blocked by; a HITL task
describing software to build is mis-typed.
_Avoid_: approval step, manual task

**Eligible task**:
An AFK task that is open and whose every prerequisite is satisfied — done or
skipped. A skipped prerequisite unblocks its dependents even though it was
deferred, not completed.

**Progress record**:
The append-only journal of a Task set: one distilled entry per terminal
transition (done, failed, manual completion, reopen, skip) plus the agent's
summary. Read by humans and by gates; it records outcomes, never the approach
that produced them.
_Avoid_: log, transcript, history file

**Sidecar state**:
Cook's per-set execution-state file, holding what is neither State nor
Journal: the verdict cache, episode fingerprints, attempt counters, and
remediation depth used. Pop keeps the same facts in its database; cook keeps
them beside the set.
_Avoid_: database, cache file, lockfile

**Attempt record**:
A small per-attempt note of one Attempt's ordinal, outcome, failure reason,
and narrative tail. It exists solely as substrate for the Retry carry-forward
digest — it is not telemetry.
_Avoid_: captured run, stream, transcript

### The nested loops

**Implement run**:
One invocation of a whole-set implement — from set selection to exit. It owns
the gate conversations and the refine and verify phases, and holds at most one
live Drain at a time; reaching a gate parks the Drain, and resuming begins a
fresh one.
_Avoid_: session, drain session, run

**Drain**:
One supervised pass over a Task set, executing Eligible tasks one after
another until the set reaches a terminal disposition. A set may be drained
many times; each is a distinct Drain. It runs as a sequence of Drain turns and
reads configuration afresh at each, except for what it settles at start: the
commit rules and how a dirty checkout is treated.
_Avoid_: ralph loop, run, attempt

**Drain turn**:
One pass of a Drain's loop: the Drain re-reads its inputs — the Task set's
manifest, its Sidecar state and cook's configuration — then either selects the
next AFK task or, with AFK work finished, reaches the phase steps (Refine,
verification, the terminal status). A configuration change made while a Drain
runs applies at its next turn, never sooner and never later; a configuration
that fails to load leaves the previous turn's configuration in force, and the
Drain says so once.
_Avoid_: iteration, tick, loop pass, phase boundary

**Attempt**:
One invocation of a fresh-context subagent against one task. Pop's attempt is
a subprocess; cook's is a subagent — the isolation contract (fresh context, no
shared conversation state) is the same.
_Avoid_: try, iteration

**Task retry cap**:
The maximum started Attempts per task before the task fails — orchestrator-
checked against the Sidecar state, never enforced mid-flight. What exhaustion
does turns on how the last Attempt stopped (pop's Exhausted walk disposition,
ported for one agent): a crash — the Host's machinery stopping the run — is
never the task's fault, so the task stays open for a later drain; an Attempt
that ran to an ending and missed the contract fails the task, for a human.
_Avoid_: max-tries flag alone, attempt count

**Prior-art check**:
The obligation cook's implementer prompt puts on an Attempt before it writes
mechanism — a busy flag, a `catch` that turns an error into a message, a
success notice, a confirmation, a retry — to first find the composed form the
repository already has, and to name in its summary what it matched or state
that no prior art existed. Trigger-led rather than location-led: the search
walks the task's Orientation files, the directory the change lands in, and the
repository, stopping at the first hit. It is the prompt's own, not the
Implementation convention's, so it rides every implement prompt; the Refiner
carries its inverse.
_Avoid_: neighbour read, house-idiom check, read the surrounding code

**Retry carry-forward digest**:
The prompt section a retry Attempt receives, carrying each prior Attempt's
lesson (whether the approach stood) and a short narrative of what it did.
Derived from Attempt records; injected only on the second Attempt onward.
_Avoid_: retry context, memory, hint block

**Turn**:
One model message within an Attempt — a single call to the model, regardless
of how many tool invocations it carries.

**Turn cap**:
The maximum Turns one Attempt may spend before its agent stops itself. It
bounds the innermost of the four nested loops (turns, not Attempts, not a
Drain, not an Implement run). Blind on both of cook's hosts: neither can
enforce it, so cook declares the incapacity rather than pretending.
_Avoid_: max turns, step limit, iteration cap, ralph limit, attempt cap

### Verification and Refine

**Verifier**:
An independent agent that judges a Task set's completed AFK work against each
task's acceptance criteria. Independence in cook means fresh context with no
shared conversation state, not a different vendor.
_Avoid_: checker, QA agent

**Verify verdict**:
The Verifier's three-way judgment: PASS (every criterion met), FIXABLE
(criteria unmet but an agent could resolve the findings), NEEDS-HUMAN (the
findings need a human decision).
_Avoid_: verification result, score

**Verification episode**:
One contiguous stretch during which a set's done-AFK work composition is
unchanged. A PASS within the episode immunizes the set's terminal status
against later commits; the episode ends when an AFK task reopens or newly
becomes done, never on HITL-only movement.

**Verification invalidation**:
Clearing a set's cached Verify verdicts, ending the current Verification
episode so the next completion requires fresh verification. Triggered by any
AFK task moving into open or done, and by Remediation task spawn.

**Remediation task**:
An AFK task spawned to fix Verifier findings — automatically on FIXABLE, or by
a human choosing to remediate. A Drain picks it up like any Eligible task,
bounded by Remediation depth. Marked in the manifest by its `origin` (`auto` or
`human`), which is how the Refine episode leaves it out.
_Avoid_: fix task, follow-up

**Remediation depth**:
The per-set cap on Remediation task spawns, after which the set parks at
VERIFY-FAILED.

**Verify report**:
The document verification publishes for a Task set: what the Verifier checked:
one line for each clause of each acceptance criterion, naming the command it ran
and the result — the prose remainder of its
reply, the `VERDICT:` line lifted off the front. One per Verifier invocation,
timestamped under the set's `verify/` directory, latest by timestamp; written on
every verdict, PASS included; it survives Verification invalidation, being the
durable account the verdict cache never was. An Accepted verdict gets one too,
written by the Orchestrator with the human's note and the verdict it overrode.
It answers *why*, never *whether*. Humans meet it as a **Verify pointer** — its
path and the commit it was written against, rendered only where a human reads,
never in an agent prompt.
_Avoid_: verify artifact, verdict document, findings file, verification log

**Forced verification**:
A Verifier run a human starts directly — `/cook:verify` — rather than the tail
of a Drain. It always invokes the Verifier, records the verdict and publishes a
Verify report, but enacts nothing on its own: a non-PASS verdict, FIXABLE under
the cap included, ends at the Verify-failed gate so the human dispositions it
in the same sitting; exiting leaves the verdict cached for the next Drain to
enact.
_Avoid_: standalone verify, manual verify, force verify, re-verify

**Refine**:
The Drain step, formerly code review, that holds a Task set's accumulated
changeset to the resolved Implementation convention: a fresh Refiner fixes in
place what its licence allows and writes the Refine report, and the
Orchestrator commits its fixes as one Refine commit. It runs before the verify
phase, so its edits are judged by the same verification as the work they
refine. It reaches no verdict, spawns no task and gates nothing. On by default
in cook (pop: off); automatic Refine skips a Human completion; `/cook:refine`
runs a full pass by hand.
_Avoid_: code review, review step, code quality check, polish, lint step

**Refiner**:
The agent that performs Refine, in a fresh context. Its licence is
*reversibility*: a fix that can be undone by inspection and whose whole effect
it can see, it makes, where the standard names it; behaviour, exported
interfaces, stored shapes and expensive-to-reverse structure stay findings. It
runs the scoped gate before and after its edits, reading the Verification
convention itself. It never commits and never touches `.cook/`.
_Avoid_: Reviewer, polisher, fixer, critic, linter

**Refine outcome**:
The machine-read line a Refiner puts before its report —
`REFINE-OUTCOME: refined | gate-blocked | abandoned`. `gate-blocked` is a red
scoped gate on entry: nothing fixed, nothing committed. `abandoned` is a red
gate on exit: the Orchestrator discards the pass's edits. Self-reported like a
verdict, and caught one step later by verification when it lies.
_Avoid_: gate result, refine status, pass verdict

**Refine report**:
The living document Refine maintains for a Task set, in three parts: what the
pass **Fixed**, what it **Left in this changeset**, and what it found
**Revealed by this changeset**. The first two are replaced each pass, carrying
forward what is still true; the third is stated once and never carried forward.
Timestamped under the set's `refine/` directory, latest by timestamp. Humans
and gate prompts meet it as a **Refine pointer** — its path, the commit it
describes, and an out-of-date flag — never its body.
_Avoid_: review, review document, findings file, smell list, backlog

**Revealed finding**:
A finding whose shape predates the changeset that exposed it, as against a
*created* one the changeset introduced — checkable with `git show
<base>:<file>`. A created problem belongs to reviewing this work; a revealed one
is future refactoring work, and always names the refactoring it wants.
_Avoid_: pre-existing smell, out-of-scope finding, technical debt item

**Refine commit**:
The Orchestrator-made commit capturing one Refine pass's in-place fixes: one
per pass that fixed something, subject `cook(<set-id>): refine`, the set named
in a `Cook-Refine:` trailer. It does not invalidate a prior PASS.
_Avoid_: polish commit, style commit, fix commit

**Refine episode**:
Formerly the Review episode: the fingerprint of a set's done AFK tasks that are
not Remediation tasks, recorded only when a pass reports `refined`. A
verify-remediation lap therefore re-verifies without re-refining, and a
gate-blocked or abandoned pass leaves the episode armed.
_Avoid_: Review episode, refine cycle, refine generation

**Refine mark**:
Whether a terminal Task set's changeset was held to the standard at all —
Refined, or Not refined (never ran, interrupted, gate-blocked, abandoned) —
carried beside its status the way the verification mark is. It gates nothing;
only the gate-blocked reason is spelled out, being a fact about the work rather
than the pass.
_Avoid_: refine status, refine flag, unrefined badge

### Conventions

**Implementation convention**:
What good code looks like in the target repository, code and tests as one
subject. The Refiner always carries it; the implementer only when
`include_implementation_convention` is set; the Verifier never, since a
quality standard in the hands of the role that can fail a set turns taste into
VERIFY-FAILED. It states standards, never licence.
_Avoid_: standards convention, refine convention, code-review convention

**Verification convention**:
How work is checked in the target repository — the build and test invocation,
which gate is scoped and which whole-tree, what counts as evidence.
Role-driving: it is the body of the Verifier's checking section, and the
Refiner reads it for its scoped gate.
_Avoid_: checks convention, verify convention, test convention

**Convention stack**:
How a convention kind resolves to one answer: the repository's
`docs/agents/<kind>.md` when it holds something, else cook's **Shipped
convention** (`conventions/<kind>.md`). Winner-take-all, not composition, and
it always answers. Pop's stack has two further, per-user ranks above these;
cook ports only these two.
_Avoid_: convention precedence, convention merge order

**Shipped convention**:
Cook's own answer for a convention kind — pop's shipped text with cook's
recorded edits — displaced whole by the repository's document. Generic by
construction; not a house style, and not a floor beneath the repository's.
_Avoid_: cook defaults, fallback convention, house style, baseline

**Overlay**:
The one layer that *appends* rather than replaces: the repository's
`docs/agents/refine.overlay.md`, riding along with the Refiner's prompt. It is
how a team steers the refine procedure, which no convention can replace.
_Avoid_: convention overlay, step overlay, convention override

### Attempts and commits

**Implementation commit**:
The one commit the Orchestrator makes per completed task: the task's planned
subject (or the default format), the agent's summary as body, and the task
trailer in its own paragraph. The Attempt itself never commits.
_Avoid_: auto-commit, agent commit

**Set base commit**:
The parent of a set's first Implementation commit, recorded so the set's whole
commit range can be reconstructed for the Verifier and Refiner without a
merge-base computation.

**No-Op completion**:
A task that completes with a clean working tree: marked done, no commit made.

### Gates

**HITL gate**:
Where a Drain stops because an open HITL task blocks further work or is the
last thing left. The human completes, defers, edits-and-reruns, or exits
without change.
_Avoid_: approval prompt, pause

**Failed gate**:
Where a Drain stops because a task exhausted its Task retry cap. The human
either fixes the checkout so a fresh Attempt can pass, or completes the task
by hand.

**Verify-failed gate**:
Where an Implement run stops on a NEEDS-HUMAN verdict or exhausted Remediation
depth. The human accepts (a human-authored PASS), remediates, or exits without
disposition.

**Interrupt gate**:
Where a Drain stops because a live Attempt was interrupted mid-run. The human
continues draining or exits; the interrupted task stays open either way.

### Status

**Task set status**:
The derivation every read surface shares: READY (has an Eligible task),
BLOCKED (open AFK work gated behind a human task), AWAITING-APPROVAL (only
human sign-off left), VERIFY-FAILED (verification could not clear it),
NEEDS-VERIFY (terminal work with no PASS in the current episode), DONE,
FAILED, DEFERRED, MALFORMED (a registration or contract fault, outside the
normal derivation).
_Avoid_: state, phase

### Architecture

**Orchestrator**:
The human's own agent session following cook's drain skill: it selects tasks,
spawns Attempts, assesses their output, commits, and runs the gates. It is
instructions over files, not a process — all truth lives in the set's files,
so a crashed or wandering Orchestrator is re-entered by invoking the skill
again.
_Avoid_: runner, daemon, supervisor

**Host**:
The agent product cook runs inside — Claude Code or opencode. Each Host
declares which capabilities it supports (fresh-context subagent spawn,
structured asking), which it is Blind to (Turn cap, timeout kill), and which
are merely Human-facing, pop-style: an incapacity is declared, never papered over.
_Avoid_: platform, runtime

**Human-facing**:
A capability declaration for a Host affordance whose audience is the human
rather than cook's own logic. Distinct from Blind in sentiment, not just in
degree: Blind means cook must not rely on it and that is a loss, carrying the
reason; Human-facing means nothing relies on it and that is the design.
_Avoid_: advisory, informational, cosmetic, nice-to-have

**Delivery note**:
A per-host reference file inside a skill's references, mapping each
capability the skill names (fresh-context subagent spawn, structured gate
ask, the shared prompts path) to that Host's concrete mechanism. Skills name
capabilities only; the delivery note is the single place host-specific
mechanics may appear in skill text.
_Avoid_: host section, host mapping, platform notes

**Subagent trace**:
Whatever record of one subagent's run the Host produces and keeps — its shape
is the Host's business, and so is where it lives, so long as that is never
under `.cook/`: a trace is the Host's artifact, not cook's. Nothing in cook
reads a trace: no status derives from one, no gate consults one, and deleting
every trace on a machine changes nothing cook would decide. Reserve the word
for this: a Progress record, an Attempt record, and a Refine or Verify report are never
traces.
_Avoid_: log, transcript, telemetry, captured run, run history

**Companion skills**:
The five skills the plan verb orchestrates but cook did not author —
grill-with-docs, grilling, domain-modeling, to-spec, to-tickets — shipped as
verbatim vendored copies of an upstream MIT skill set (ADR-0010,
`PROVENANCE.md`). Reserve the word for those five: cook's own drain,
plan, and register skills are never companions. A human can still author sets
by hand against the storage contract, but a machine missing a companion is a
broken install, not a supported mode.
_Avoid_: dependency skills, external skills, third-party skills

## Sources in pop

- `GLOSSARY.md` in pop (its `CONTEXT.md` until pop ADR-0285) — the glossary these terms are imported from verbatim:
  Drain, Drain turn, Implement run, Turn, Turn cap, Task retry cap, Task
  attempt / Exhausted walk disposition, Prior-art check, AFK/HITL typing,
  Verifier, Verify verdict, Verify report / Verify pointer, Forced
  verification, Verification episode/invalidation, Remediation task/depth,
  Refine, Refiner, Refine outcome / report / pointer / commit / episode / mark,
  Revealed finding, Implementation convention, Verification convention,
  Convention stack, Shipped convention, Overlay, Task set status derivation.
- pop ADR-0190 — the "ralph stays out of the vocabulary" rule and the
  four-nested-loops framing.
- pop ADR-0211 — planned commit subjects; ADR-0216 — Set base commit.
- pop ADR-0231 (provider crash leaves a task open), ADR-0245 (Verify report),
  ADR-0246/0247/0248/0252/0260 (Refine), ADR-0259 (Prior-art check), ADR-0267
  (Drain turn).
- pop ADR-0216 — the task trailer on every Implementation commit.
