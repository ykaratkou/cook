#!/usr/bin/env bash
# Smoke test for the cook_subagent seal (task 03, item 8).
#
# Runs the exact seal argv against the real local `pi` binary with a
# trivial prompt delivered on stdin (never argv), then asserts that the
# same final-assistant-message extraction index.ts uses — last
# `message_end` event with message.role === "assistant", first content[]
# part of type "text" — yields the expected marker.
#
# Dependency-free: needs only bash, the `pi` binary, and `node` (pi's own
# runtime, so it is present wherever pi runs). No npm install required.
set -euo pipefail

PI_BIN="${PI_BIN:-pi}"
MARKER="COOK-SMOKE-OK"
PROMPT="Reply with exactly: ${MARKER}"

fail() {
	echo "SMOKE FAIL: $*" >&2
	exit 1
}

command -v "$PI_BIN" >/dev/null 2>&1 || fail "pi binary not found (set PI_BIN)"
command -v node >/dev/null 2>&1 || fail "node not found (pi's own runtime)"

# The seal — must stay byte-identical to SEAL_ARGV in index.ts.
# Prompt on stdin only; no positional prompt argument; no --model.
set +e
OUT="$(printf '%s' "$PROMPT" | "$PI_BIN" \
	--mode json -p \
	--no-session --no-extensions --no-skills \
	--no-context-files --no-prompt-templates \
	--tools read,bash,edit,write,grep,find,ls 2>/dev/null)"
EXIT_CODE=$?
set -e

[ "$EXIT_CODE" -eq 0 ] || fail "sealed pi child exited with code $EXIT_CODE"
[ -n "$OUT" ] || fail "sealed pi child produced no stdout"

# Final-assistant-message extraction: the message_end filter from index.ts.
FINAL="$(printf '%s\n' "$OUT" | node -e '
let buf = "";
process.stdin.on("data", (c) => { buf += c; });
process.stdin.on("end", () => {
  let final;
  for (const line of buf.split("\n")) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type !== "message_end" || !event.message) continue;
    if (event.message.role !== "assistant") continue;
    final = event.message;
  }
  if (!final) process.exit(3);
  for (const part of final.content || []) {
    if (part.type === "text" && typeof part.text === "string") {
      process.stdout.write(part.text);
      process.exit(0);
    }
  }
  process.exit(4);
})' )" || fail "no assistant message_end (or no text part) in JSONL output"

case "$FINAL" in
	*"$MARKER"*) ;;
	*) fail "final assistant text does not contain marker; got: $FINAL" ;;
esac

echo "SMOKE OK: seal + stdin prompt + final-message extraction -> $FINAL"
