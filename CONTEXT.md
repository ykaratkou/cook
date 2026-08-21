# Cook

Cook is an in-agent plugin (Claude Code now, Pi next) that ports pop's task-set
implement feature: the drain with its nested loops, the verification tail, the
remediation loop, the review document, and the human gates. This glossary
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
the gate conversations and the verify and review phases, and holds at most one
live Drain at a time; reaching a gate parks the Drain, and resuming begins a
fresh one.
_Avoid_: session, drain session, run

**Drain**:
One supervised pass over a Task set, executing Eligible tasks one after
another until the set reaches a terminal disposition. A set may be drained
many times; each is a distinct Drain.
_Avoid_: ralph loop, run, attempt

**Attempt**:
One invocation of a fresh-context subagent against one task. Pop's attempt is
a subprocess; cook's is a subagent — the isolation contract (fresh context, no
shared conversation state) is the same.
_Avoid_: try, iteration

**Task retry cap**:
The maximum started Attempts per task before the task fails — orchestrator-
checked against the Sidecar state, never enforced mid-flight.
_Avoid_: max-tries flag alone, attempt count

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

### Verification and review

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
bounded by Remediation depth.
_Avoid_: fix task, follow-up

**Remediation depth**:
The per-set cap on Remediation task spawns, after which the set parks at
VERIFY-FAILED.

**Reviewer**:
An independent agent that writes a code-review document of everything a set
changed — how well the code is written, not whether it works. It reaches no
verdict and gates nothing.
_Avoid_: critic, approver

**Review episode**:
The fingerprint of a set's done-AFK task ids at review time. A commit that
only moves the work SHA does not re-review; a newly finished task —
Remediation tasks included — does.

### Attempts and commits

**Implementation commit**:
The one commit the Orchestrator makes per completed task: the task's planned
subject (or the default format), the agent's summary as body, and the task
trailer in its own paragraph. The Attempt itself never commits.
_Avoid_: auto-commit, agent commit

**Set base commit**:
The parent of a set's first Implementation commit, recorded so the set's whole
commit range can be reconstructed for the Verifier and Reviewer without a
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
The agent product cook runs inside — Claude Code or Pi. Each Host declares
which capabilities it supports (fresh-context subagent spawn, structured
asking), which it is Blind to (Turn cap, timeout kill), and which are merely
Human-facing, pop-style: an incapacity is declared, never papered over.
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
The JSON event stream one subagent spawn emitted, kept wherever the Host keeps
such things — never under `.cook/`, because it is the Host's artifact and not
cook's. Nothing in cook reads a trace: no status derives from one, no gate
consults one, and deleting every trace on a machine changes nothing cook would
decide. Reserve the word for this: a Progress record, an Attempt record, and a
review are never traces.
_Avoid_: log, transcript, telemetry, captured run, run history

**Companion skills**:
Skills cook requires but does not ship — grill-with-docs, to-spec, to-tickets —
orchestrated by the plan verb. A machine without them can still author sets by
hand against the storage contract.

## Sources in pop

- `CONTEXT.md` in pop — the glossary these terms are imported from verbatim:
  Drain, Implement run, Turn, Turn cap, Task retry cap, AFK/HITL typing,
  Verifier, Verify verdict, Verification episode/invalidation, Remediation
  task/depth, Review episode, Task set status derivation.
- pop ADR-0190 — the "ralph stays out of the vocabulary" rule and the
  four-nested-loops framing.
- pop ADR-0207 — Set base commit and planned commit subjects.
- pop ADR-0216 — the task trailer on every Implementation commit.
