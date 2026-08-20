#!/usr/bin/env bash
# Cook loop hardening (optional; correctness never depends on it — spec 10).
# Blocks the orchestrator's stop once when a live drain seems mid-flight:
# a fresh drain.lock exists, meaning the drain loop did not reach an exit
# path (every exit path, gates included, removes the lock).
set -u

input="$(cat)"

# Bound re-injection: if this stop already follows a stop-hook block, let it
# through. A wandering drain is then the human's `/cook` re-entry, by design.
case "$input" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

[ -d .cook/tasks ] || exit 0

fresh_lock="$(find .cook/tasks -mindepth 2 -maxdepth 2 -name drain.lock -mmin -10 2>/dev/null | head -n 1)"
[ -n "$fresh_lock" ] || exit 0

set_id="$(basename "$(dirname "$fresh_lock")")"
cat >&2 <<EOF
A fresh drain lock exists at ${fresh_lock} (set: ${set_id}), so a cook drain
appears to be mid-flight. If you are the drain orchestrator of this set:
continue the drain loop — re-derive the set's status from its files and run
the next iteration; do not end your turn while the set derives READY and no
gate is open. If you are NOT the orchestrator (another session holds this
lock), say so briefly and end your turn; do not touch the lock.
EOF
exit 2
