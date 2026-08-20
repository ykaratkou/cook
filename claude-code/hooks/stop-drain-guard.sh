#!/usr/bin/env bash
# Cook loop hardening (optional; correctness never depends on it — spec 10).
# Blocks the orchestrator's stop once when its own drain seems mid-flight:
# a fresh drain.lock exists whose session token this session typed, meaning
# the drain loop did not reach an exit path (every exit path, gates
# included, removes the lock).
#
# Scoping: the orchestrator typed the lock's session token when it wrote the
# lock, so the token appears in that session's transcript and no other's.
# We nag only on a positive match; an unreadable transcript, an empty token,
# or a lock written by another host stays silent — hardening is optional
# (spec 10), a false nag in an unrelated session is the bug.
set -u

input="$(cat)"

# Bound re-injection: if this stop already follows a stop-hook block, let it
# through. A wandering drain is then the human's `/cook` re-entry, by design.
case "$input" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

[ -d .cook/tasks ] || exit 0

# The stopping session's transcript, from the hook's stdin JSON.
transcript="$(printf '%s' "$input" | sed -n 's/.*"transcript_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
case "$transcript" in "~"*) transcript="${HOME}${transcript#\~}" ;; esac
[ -n "$transcript" ] && [ -r "$transcript" ] || exit 0

# Check every fresh lock: nag only for one whose session token this session
# typed (i.e. the token appears in this session's own transcript).
find .cook/tasks -mindepth 2 -maxdepth 2 -name drain.lock -mmin -10 2>/dev/null |
while IFS= read -r fresh_lock; do
  token="$(sed -n 's/.*"session"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$fresh_lock" 2>/dev/null)"
  [ -n "$token" ] || continue
  grep -qF -- "$token" "$transcript" 2>/dev/null || continue
  set_id="$(basename "$(dirname "$fresh_lock")")"
  cat >&2 <<EOF
A fresh drain lock exists at ${fresh_lock} (set: ${set_id}), and its session
token is yours, so your cook drain appears to be mid-flight. Continue the
drain loop — re-derive the set's status from its files and run the next
iteration; do not end your turn while the set derives READY and no gate is
open. If the drain has in fact reached an exit path, remove the stale lock
and report the disposition.
EOF
  exit 2
done
# The while loop runs in a subshell: propagate its exit 2, else stay silent.
[ $? -eq 2 ] && exit 2
exit 0
