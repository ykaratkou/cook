#!/usr/bin/env bash
# Cook depends on another project's output format.
#
# `skills/drain/references/host-pi.md` tells the orchestrator that a
# foreground `Agent` result is a stats header, a blank line, then the
# subagent's reply — and that the reply is everything after that blank line.
# Cook's core reads a Verifier's `VERDICT:` as the reply's first line, so if
# @tintinweb/pi-subagents ever changes that framing, every verify parse on
# this host breaks silently. Nothing but this check notices (ADR-0011, and
# the matching drift-guard item in PARITY.md).
#
# Exercises it against your real local pi and your real installed
# pi-subagents. Needs bash, `pi`, and node.
#
#   pi/extension/smoke-test.sh
#
# Expected: `SMOKE OK`. Override the binary with PI_BIN and the package entry
# with PI_SUBAGENTS_ENTRY.

set -euo pipefail

PI_BIN="${PI_BIN:-pi}"
SENTINEL="COOK-SMOKE-OK"

agent_dir="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
default_entry="$agent_dir/npm/node_modules/@tintinweb/pi-subagents/src/index.ts"
entry="${PI_SUBAGENTS_ENTRY:-$default_entry}"

if [ ! -f "$entry" ]; then
	echo "SMOKE SKIP: no pi-subagents at $entry" >&2
	echo "  install it (pi install @tintinweb/pi-subagents), or set PI_SUBAGENTS_ENTRY." >&2
	exit 2
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# -ne so only pi-subagents loads: this pins ITS framing, not a local stack's.
# The spawn flags are exactly the ones the delivery note mandates.
"$PI_BIN" --mode json -p --no-session -ne -e "$entry" \
	"Call the Agent tool exactly once with: subagent_type='general-purpose', \
isolated=true, run_in_background=false, description='cook smoke check', \
prompt='Reply with exactly this and nothing else: $SENTINEL'. Then reply DONE." \
	>"$workdir/stream.jsonl" 2>"$workdir/stderr.txt" || {
	echo "SMOKE FAIL: pi exited non-zero" >&2
	tail -20 "$workdir/stderr.txt" >&2
	exit 1
}

SENTINEL="$SENTINEL" node - "$workdir/stream.jsonl" <<'NODE'
import fs from "node:fs";

const sentinel = process.env.SENTINEL;

// The Agent result is a tool result nested somewhere in the event stream;
// walk rather than pin a shape, so a stream-schema change is not read as a
// framing change.
const found = [];
const walk = (node) => {
	if (!node || typeof node !== "object") return;
	if (typeof node.text === "string" && /^Agent (completed|failed)/.test(node.text)) {
		found.push(node.text);
	}
	for (const value of Object.values(node)) walk(value);
};
for (const line of fs.readFileSync(process.argv[2], "utf8").split("\n")) {
	if (!line.trim()) continue;
	try { walk(JSON.parse(line)); } catch {}
}

const fail = (msg) => { console.error(`SMOKE FAIL: ${msg}`); process.exit(1); };

if (found.length === 0) fail("no Agent tool result in the stream (did the model call it?)");
const result = found[0];
if (result.startsWith("Agent failed")) fail(`the subagent run failed:\n${result}`);

// The contract the delivery note states, in three parts.
const [header, ...rest] = result.split("\n\n");
if (!/^Agent completed in .+\(.+\)\.?$/.test(header.trim())) {
	fail(`header is not the documented stats line:\n  ${JSON.stringify(header)}`);
}
if (rest.length === 0) fail("no blank line separating header from reply");
const reply = rest.join("\n\n");
if (reply.trim() !== sentinel) {
	fail(`reply after the blank line is not the subagent's message verbatim:\n  ${JSON.stringify(reply)}`);
}

console.log(`SMOKE OK: header + blank line + reply -> ${sentinel}`);
NODE
