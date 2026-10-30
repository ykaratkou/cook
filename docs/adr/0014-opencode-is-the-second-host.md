---
status: accepted; partly superseded by ADR-0015
date: 2026-09-29
---

# opencode is the second host

> **Superseded on one point** (2026-10-30, by ADR-0015): cook has no drain
> lock and no loop hardening, so the plugin no longer watches for idle
> sessions and the command trailer no longer carries the session id.

ADR-0012 made Claude Code the one host and kept the seam: the capability
matrix, skills that name capabilities, per-host delivery notes, and the shared
root `skills/`, `prompts/`, and `conventions/`. We decided **opencode 2.x
joins Claude Code as a second peer host**, at full command parity (the six
cook verbs), with every fact pinned to opencode v2.0.20. opencode 1.x is not
supported. Its plugin API does not run on 2.x, and 2.x renamed the tools cook
names (`task` → `subagent`, `bash` → `shell`).

The adapter is **one opencode v2 plugin** (`Plugin.define`). It registers the
six commands, the eight cook skills, and the drain loop hardening, and it
injects runtime-resolved paths into every command. opencode has no
counterpart to `${CLAUDE_PLUGIN_ROOT}`. A plugin can resolve its own location,
but markdown commands and agents cannot. So the plugin, not an install
script, is what makes shipped text point at the one shared copy.

## Consequences

**ADR-0012 is superseded in its "one host" clause only.** Its removal of pi
stands, and so do ADR-0007 and ADR-0011, which stay superseded.

**Commands keep the `/cook:<verb>` spelling.** They are registered as
`cook:drain` and so on, so a human types the same verb on both hosts. If
opencode's TUI rejects a colon in a command name, the fallback is its native
nesting (`/cook/drain`), recorded here as an amendment. The pi precedent does
the same.

**Skills are registered as `cook/<name>`.** opencode derives skill ids from
folder names, with no plugin namespace. A later source with the same id wins,
and opencode also reads `~/.claude/skills`. The `cook/` prefix plays the role
of Claude Code's `cook:` prefix: a user's own `grilling` or `to-spec` never
shadows cook's copy. The vendored copies stay verbatim (ADR-0010). opencode
ignores `disable-model-invocation`, so the plugin hides cook's own three
skills from the model with opencode's autoinvoke switch instead.

**The Turn cap stays Blind on opencode.** Agents do have a `steps` cap, but a
capped child returns a forced summary under the same `completed` state as a
finished one. The orchestrator cannot recognize the bound, and pop's rule is
that only a party that can recognize a bound may emit it. Revisit when
opencode reports cap exhaustion distinctly. Timeout kill is Blind too:
opencode has no subagent timeout.

**Loop hardening is event-driven, not a blocking stop.** opencode has no hook
that vetoes a turn ending. The plugin watches for the orchestrator session
going idle while a fresh `drain.lock` names that session. It then queues one
continue-the-drain prompt, never twice in a row. Because the plugin knows the
real session id, the lock's `session` token is that id, not a random token.
The capability stays Human-facing (ADR-0009): correctness never depends on
it.

**A backgrounded spawn is waited for, not failed.** The human can push a
running foreground subagent into the background. The spawn's first result is
then a notice, not the run's output. The orchestrator waits for the
completion notification and parses it as it would a foreground result.

**The skills stop naming one host's note.** Each host's command wiring names
its own delivery note, and skill text says "your host's delivery note".
Claude Code's behaviour does not change.

## Amendment (2026-10-30): colon command names work

Checked in the opencode 2.0.20 TUI with the plugin loaded from a checkout
path: a command registered as `cook:status` autocompletes from `/cook`, the
colon types through (`/cook:st` still matches), and running it delivers the
command text to the session. The colon spelling stands for all six verbs; the
nested `/cook/<verb>` fallback is not needed.

## Sources

- User decisions, 2026-09-29 (`/cook:plan opencode v2 integration`
  interview, Q1–Q13).
- opencode v2.0.20 as installed (`~/.opencode/bin/opencode`) and the V2 docs
  at https://opencode.ai/v2/docs/.
- Cook ADR-0004 (attended only), ADR-0006 (delivery notes), ADR-0009
  (Human-facing), ADR-0010 (vendored companions), ADR-0012 (partly
  superseded here); pop ADR-0190 (turn cap).
