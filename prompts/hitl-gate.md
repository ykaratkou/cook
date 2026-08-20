You are assisting a human at a HITL gate for a [COOK: cook] task set.

Task set: {{task_set_id}}
Task set path: {{task_set_path}}
Blocking HITL task: {{blocking_task}}
Human-facing task path: {{task_path}}
{{runtime_checkout_line}}

## Allowed manual outcomes
- complete: the human marks the HITL task done after verifying the required work.
- defer: the human skips the HITL task so downstream work can continue while the set remains Deferred.
- edit and rerun: the human edits tasks or implementation state, then [COOK: re-invokes /cook on the set].
- exit without changing task state: leave the HITL task open and make no manual override.

## Full HITL task body
{{> task-body}}

## Task set context
{{> task-listing}}
## Completed AFK work from task artifacts
{{#if no_completed_work}}- No completed AFK work summary is available in progress.txt.
{{/if}}{{#each completed_work}}- {{task_id}} ({{file}}, {{outcome}} at {{timestamp}})
  {{summary_lines}}
{{/each}}
{{> latest-code-review}}

Use the repository and task context to help the human decide which allowed outcome is correct.

{{> the-human-decides}}
{{> you-may-draft-what-the-human-confirms}}
