# Partials

Named blocks included by other prompts via `{{> partial-name}}`.

## task-listing

{{#each tasks}}- {{id}} [{{type}} {{status}}{{effort_clause}}]{{title_clause}} ({{path}}){{blocked_by_clause}}
{{/each}}

## task-body

{{#if readable}}```markdown
{{body}}
```{{/if}}{{#if unreadable}}Could not read {{path}}: {{error}}.
Proceed by inspecting the task path manually or asking the human for the missing task body.{{/if}}

## the-human-decides

The human decides every outcome here. You do not effect a disposition — no task status change (complete, skip, reset, reopen), no verdict recorded, no accept, no remediation spawned — even when the human has told you which outcome they want; they effect it themselves [COOK: through the gate's structured answer].

## you-may-draft-what-the-human-confirms

You may draft what the human then confirms. A task body, a Remediation task, an edit to the task manifest, or implementation under the runtime checkout are all yours to prepare when the human asks for them: preparing an artifact is not deciding the outcome. Say plainly what you prepared, and leave the transition to the human.
1. You may create a new Task set, or append a task to this one, when the human asks.
2. Default to *this* set; mint a new set only when the idea sits beyond this set's slice.
3. [COOK: Follow the task-set format contract (the register skill / spec doc 01) before writing — it is authoritative for file shape.]
4. [COOK: Writing files only *drafts*. Run /cook:register and work the fix list until the set reads READY.]
5. Creating work is not a disposition — it completes, skips, accepts and remediates nothing at this gate.
An appended task that the set's open HITL gates should wait on is wired into those gates' `blocked_by`, the way a remediation spawn wires itself.

## latest-code-review

{{#if has_review}}
## Latest code review (NOT inlined — read the file yourself)
- Document: {{path}}
{{#if commit}}- Written against: {{commit}}
{{/if}}{{#if out_of_date}}- Out of date: the checkout has moved past that commit. Parts of it may describe files as they no longer are; check what changed since before you act on a finding.
{{/if}}- It is one Reviewer's opinion against this repository's standards. It reaches no verdict and gates nothing; read it when the human asks what to do about the review, and treat acting on it as the human's call.
{{/if}}
