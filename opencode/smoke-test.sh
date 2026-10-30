#!/usr/bin/env bash
# Cook's opencode adapter depends on the installed opencode's behaviour.
#
# The opencode delivery note (skills/drain/references/host-opencode.md) and
# the plugin (opencode/index.ts) assume rows of the capability matrix that
# only the real binary can confirm: the plugin loads from a checkout path and
# registers six `cook:<verb>` commands and eight `cook/<dir>` skills; a git-spec
# install of the repo root reaches the shared skills/, prompts/, and
# conventions/ (ADR-0016); a
# `subagent` spawn with `agent: "general"` hands back the child's final text
# inside the `<subagent … state="completed">` wrapper; that child can write
# files and run shell; and a headless `question` comes back dismissed, never
# answered. A future opencode release that breaks one of these is caught by
# running this one command (spec 10, ADR-0014).
#
# Exercises them against your real installed opencode (2.0.20 pinned), through
# the binary's own CLI and API, with no mocking. Exits non-zero at the first
# failed check. Needs bash, node, git, and a configured model; checks 3 to 5
# spend a few model calls, and check 6 fetches the plugin's npm dependencies.
#
#   opencode/smoke-test.sh
#
# Expected: `SMOKE OK`. Override the binary with OPENCODE_BIN and the model
# with COOK_SMOKE_MODEL (provider/model, as `opencode run --model` takes it).
#
# Isolation: every opencode process here runs with OPENCODE_CONFIG_DIR set to
# a throwaway config dir (it replaces the global config dir), against a
# private `opencode serve`, from scratch working directories. Your
# ~/.config/opencode is never written; the script checks that at the end. The
# sessions it creates are deleted, and the scratch dir is removed on exit.

set -euo pipefail

OPENCODE_BIN="${OPENCODE_BIN:-$HOME/.opencode/bin/opencode}"
command -v "$OPENCODE_BIN" >/dev/null || OPENCODE_BIN="$(command -v opencode || true)"
if [ -z "$OPENCODE_BIN" ] || [ ! -x "$OPENCODE_BIN" ]; then
	echo "SMOKE SKIP: no opencode binary (set OPENCODE_BIN)" >&2
	exit 2
fi

adapter_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(dirname "$adapter_dir")"
user_config="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"

expected_commands="cook:drain cook:plan cook:refine cook:register cook:status cook:verify"
expected_skills="cook/domain-modeling cook/drain cook/grill-with-docs cook/grilling cook/plan cook/register cook/to-spec cook/to-tickets"
not_autoinvoked="cook/drain cook/plan cook/register"

scratch="$(mktemp -d "${TMPDIR:-/tmp}/cook-opencode-smoke.XXXXXX")"
server_pid=""
server_url=""
sessions=()

snapshot_config() {
	if [ -d "$user_config" ]; then
		(cd "$user_config" && find . -type f -print0 | sort -z | xargs -0 shasum 2>/dev/null) || true
	fi
}
config_before="$(snapshot_config)"

cleanup() {
	set +e
	if [ -n "$server_url" ]; then
		for id in ${sessions[@]+"${sessions[@]}"}; do
			"$OPENCODE_BIN" session delete --server "$server_url" "$id" >/dev/null 2>&1
		done
	fi
	if [ -n "$server_pid" ]; then
		kill "$server_pid" 2>/dev/null
		wait "$server_pid" 2>/dev/null
	fi
	rm -rf "$scratch"
}
trap cleanup EXIT

label() { printf '[%s] %s ... ' "$1" "$2"; }
ok() { echo "ok${1:+ ($1)}"; }
fail() {
	echo "FAIL"
	echo "SMOKE FAIL: $1" >&2
	[ -n "${2:-}" ] && [ -f "$2" ] && tail -20 "$2" >&2
	exit 1
}

# Run a command with a wall-clock limit (macOS ships no `timeout`): perl's
# alarm survives the exec, so the command itself is killed at the limit.
with_timeout() {
	local secs="$1"
	shift
	perl -e 'alarm shift; exec @ARGV or die "exec: $!"' "$secs" "$@"
}

# A headless `opencode run` against the private server, from a scratch cwd,
# with its JSON event stream in $2. Records the session for deletion. The exit
# status is not judged: a dismissed question ends the run non-zero, and the
# event stream is the evidence either way.
run_headless() {
	local cwd="$1" out="$2" prompt="$3"
	local model_flag=()
	[ -n "${COOK_SMOKE_MODEL:-}" ] && model_flag=(--model "$COOK_SMOKE_MODEL")
	(cd "$cwd" && with_timeout 300 "$OPENCODE_BIN" run --server "$server_url" --format json \
		${model_flag[@]+"${model_flag[@]}"} "$prompt" >"$out" 2>"$out.err") || true
	local id
	id="$(grep -o '"sessionID":"ses_[A-Za-z0-9]*"' "$out" | head -1 | cut -d'"' -f4 || true)"
	[ -n "$id" ] && sessions+=("$id")
	return 0
}

# Evaluate a node check over a file; the check prints a detail line on success
# and throws (exit non-zero, message on stderr) on failure.
#   jscheck <file> <js body using `text`, `events`, `fail(msg)`>
jscheck() {
	local file="$1" body="$2"
	node --input-type=module -e "
import fs from 'node:fs'
const text = fs.readFileSync(process.argv[1], 'utf8')
const events = text.split('\n').flatMap((line) => { try { return [JSON.parse(line)] } catch { return [] } })
const fail = (msg) => { console.error(msg); process.exit(1) }
const env = process.env
$body
" "$file"
}

# Tool parts from a `run --format json` stream.
tools_js='const tools = events.filter((e) => e.type === "tool_use" && e.part?.type === "tool").map((e) => e.part)'

# --- 1. Version -------------------------------------------------------------

label 1 "Version: opencode reports 2.0.x"
version="$("$OPENCODE_BIN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
case "$version" in
2.0.*) ok "$version" ;;
2.*) ok "WARN: $version is not the pinned 2.0.x; continuing" ;;
*) fail "opencode version '$version' is not 2.x (the adapter is a v2 plugin)" ;;
esac

# --- 2. Load ----------------------------------------------------------------

label 2 "Load: plugin loads; six commands and eight skills under settled names"
# opencode installs no dependencies for a checkout-path plugin, so a clean
# checkout needs the root package's pinned install first (gitignored). A local
# plugin directory loads from its own index.ts, so the config names opencode/,
# and Bun resolves the dependencies from the root node_modules above it.
if [ ! -d "$repo_root/node_modules/@opencode/plugin" ]; then
	(cd "$repo_root" && npm ci --no-audit --no-fund) >"$scratch/npm-ci.log" 2>&1 ||
		fail "npm ci in $repo_root failed" "$scratch/npm-ci.log"
fi
config_dir="$scratch/config"
mkdir -p "$config_dir"
printf '{\n  "$schema": "https://opencode.ai/config.json",\n  "plugins": [{ "package": "%s" }]\n}\n' \
	"$adapter_dir" >"$config_dir/opencode.json"
export OPENCODE_CONFIG_DIR="$config_dir"
OPENCODE_PASSWORD="smoke-$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"
export OPENCODE_PASSWORD

(cd "$scratch" && exec "$OPENCODE_BIN" serve --hostname 127.0.0.1 --port 0) >"$scratch/serve.log" 2>&1 &
server_pid=$!
for _ in $(seq 1 60); do
	server_url="$(sed -n 's/^server listening on //p' "$scratch/serve.log" | head -1)"
	[ -n "$server_url" ] && break
	kill -0 "$server_pid" 2>/dev/null || fail "opencode serve exited" "$scratch/serve.log"
	sleep 0.5
done
[ -n "$server_url" ] || fail "opencode serve did not start listening" "$scratch/serve.log"

api() { (cd "$scratch" && "$OPENCODE_BIN" api --server "$server_url" "$@"); }

# Commands land in one transform, after the skills, so the first `cook:` entry
# means setup reached its end. Then the full sets must match exactly.
loaded=""
for _ in $(seq 1 60); do
	api command.list >"$scratch/commands.json" 2>"$scratch/commands.err" || true
	if grep -q '"cook:' "$scratch/commands.json"; then loaded=1 && break; fi
	sleep 0.5
done
[ -n "$loaded" ] || fail "no cook: command registered within 30s (plugin did not load)" "$scratch/serve.log"
api skill.list >"$scratch/skills.json" 2>"$scratch/skills.err" || fail "skill.list failed" "$scratch/skills.err"

detail="$(EXPECTED="$expected_commands" jscheck "$scratch/commands.json" '
const got = JSON.parse(text).data.map((c) => c.name).filter((n) => n.startsWith("cook")).sort()
const want = env.EXPECTED.split(" ").sort()
const missing = want.filter((n) => !got.includes(n)), extra = got.filter((n) => !want.includes(n))
if (missing.length || extra.length) fail(`commands: missing [${missing}] unexpected [${extra}]`)
console.log(`${got.length} commands`)
')" || fail "command set differs from the settled names"
detail="$detail, $(EXPECTED="$expected_skills" HIDDEN="$not_autoinvoked" jscheck "$scratch/skills.json" '
const skills = JSON.parse(text).data.filter((s) => String(s.id).startsWith("cook"))
const got = skills.map((s) => s.id).sort(), want = env.EXPECTED.split(" ").sort()
const missing = want.filter((n) => !got.includes(n)), extra = got.filter((n) => !want.includes(n))
if (missing.length || extra.length) fail(`skills: missing [${missing}] unexpected [${extra}]`)
const visible = env.HIDDEN.split(" ").filter((id) => skills.find((s) => s.id === id)?.autoinvoke !== false)
if (visible.length) fail(`skills not marked autoinvoke=false: [${visible}]`)
console.log(`${got.length} skills`)
')" || fail "skill set differs from the settled names"
ok "$detail"

# --- 3. Spawn round-trip ----------------------------------------------------

label 3 "Spawn round-trip: subagent(general) returns the child's final text"
marker="COOK-SMOKE-$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n')"
mkdir -p "$scratch/spawn"
run_headless "$scratch/spawn" "$scratch/spawn.jsonl" \
	"Call the subagent tool exactly once with agent \"general\", description \"cook smoke spawn\", and prompt \"Reply with exactly this and nothing else: $marker\". Do not run it in the background. Then reply DONE."
MARKER="$marker" jscheck "$scratch/spawn.jsonl" "$tools_js"'
const spawn = tools.find((t) => t.tool === "subagent")
if (!spawn) fail("no subagent tool call in the stream (did the model call it?)")
if (spawn.state?.input?.agent !== "general") fail(`subagent agent is ${JSON.stringify(spawn.state?.input?.agent)}, not "general"`)
if (spawn.state?.status !== "completed") fail(`subagent tool status is ${spawn.state?.status}: ${spawn.state?.error ?? ""}`)
const match = /^<subagent [^>]*state="completed">([\s\S]*)<\/subagent>$/.exec(String(spawn.state.output).trim())
if (!match) fail(`output is not the completed wrapper:\n  ${JSON.stringify(spawn.state.output)}`)
if (match[1].trim() !== env.MARKER) fail(`child text inside the wrapper is not the marker:\n  ${JSON.stringify(match[1])}`)
' >/dev/null || fail "subagent round-trip" "$scratch/spawn.jsonl.err"
ok "$marker"

# --- 4. Write-capable child -------------------------------------------------

label 4 "Write-capable child: general child writes a file and runs shell"
work="$scratch/write"
mkdir -p "$work"
write_mark="WRITE-$marker"
shell_mark="SHELL-$marker"
run_headless "$work" "$scratch/write.jsonl" \
	"Call the subagent tool exactly once with agent \"general\", description \"cook smoke write\", and prompt: \"In the current directory, use the write tool to create child-wrote.txt containing exactly $write_mark, then use the shell tool to run: echo $shell_mark > child-shell.txt . Reply with exactly OK when both succeeded, or the error otherwise.\" Do not run it in the background. Then reply DONE."
jscheck "$scratch/write.jsonl" "$tools_js"'
const spawn = tools.find((t) => t.tool === "subagent")
if (!spawn) fail("no subagent tool call in the stream (did the model call it?)")
if (spawn.state?.input?.agent !== "general") fail(`subagent agent is ${JSON.stringify(spawn.state?.input?.agent)}, not "general"`)
if (spawn.state?.status !== "completed") fail(`subagent tool status is ${spawn.state?.status}: ${spawn.state?.error ?? ""}`)
// The primary only spawned: the files must be the child`s work.
const own = tools.filter((t) => t.tool !== "subagent").map((t) => t.tool)
if (own.length) fail(`the primary agent used tools itself: [${own}]`)
' >/dev/null || fail "write-capable child" "$scratch/write.jsonl.err"
[ "$(cat "$work/child-wrote.txt" 2>/dev/null || true)" = "$write_mark" ] ||
	fail "child-wrote.txt missing or wrong (the child could not write)"
[ "$(tr -d '\n' <"$work/child-shell.txt" 2>/dev/null || true)" = "$shell_mark" ] ||
	fail "child-shell.txt missing or wrong (the child could not run shell)"
ok "write + shell"

# --- 5. Headless gate -------------------------------------------------------

label 5 "Headless gate: a headless question comes back dismissed"
mkdir -p "$scratch/gate"
run_headless "$scratch/gate" "$scratch/gate.jsonl" \
	"Call the question tool exactly once, asking \"Cook smoke gate: pick one\" with the options \"alpha\" and \"beta\". Then report the tool result verbatim and stop."
jscheck "$scratch/gate.jsonl" "$tools_js"'
const asks = tools.filter((t) => t.tool === "question")
if (!asks.length) fail("no question tool call in the stream (did the model call it?)")
const answered = asks.filter((t) => t.state?.status === "completed")
if (answered.length) fail(`a headless question came back answered: ${JSON.stringify(answered[0].state.output)}`)
const dismissed = asks.find((t) => t.state?.status === "error" && /dismiss/i.test(String(t.state.error)))
if (!dismissed) fail(`the question did not come back dismissed: ${JSON.stringify(asks[0].state)}`)
console.log(dismissed.state.error)
' >"$scratch/gate.detail" || fail "headless question" "$scratch/gate.jsonl.err"
ok "$(cat "$scratch/gate.detail")"

# --- 6. Git-spec install ---------------------------------------------------

label 6 "Git-spec install: installed plugin reaches repo-root skills/, prompts/, conventions/"
# A fully isolated opencode home: `plugin add` writes the global config and
# installs into the cache dir, so both point into scratch. git+file installs
# the committed HEAD, so uncommitted edits are not what this checks.
iso="$scratch/git-install"
mkdir -p "$iso/config/opencode" "$iso/data" "$iso/cache" "$iso/state"
head="$(git -C "$repo_root" rev-parse HEAD)"
spec="git+file://$repo_root#$head"
(cd "$iso" && XDG_CONFIG_HOME="$iso/config" XDG_DATA_HOME="$iso/data" XDG_CACHE_HOME="$iso/cache" \
	XDG_STATE_HOME="$iso/state" OPENCODE_CONFIG_DIR="$iso/config/opencode" \
	with_timeout 300 "$OPENCODE_BIN" plugin add "$spec") >"$iso/add.log" 2>&1 ||
	fail "plugin add $spec failed" "$iso/add.log"
# The package is the repo root (ADR-0016): its index.ts sits at opencode/index.ts,
# and index.ts resolves the cook root as its own directory's parent.
installed="$(find "$iso/cache" -path '*/node_modules/cook/opencode/index.ts' | head -1)"
[ -n "$installed" ] || fail "installed, but no cook/opencode/index.ts under the cache" "$iso/add.log"
root="$(dirname "$(dirname "$installed")")"
missing=""
for d in skills prompts conventions opencode/commands; do [ -d "$root/$d" ] || missing="$missing $d/"; done
[ -z "$missing" ] || fail "missing beside the installed plugin:$missing (check package.json files)"
ok "${head:0:12}"

# --- Isolation --------------------------------------------------------------

label 7 "Isolation: ~/.config/opencode unchanged"
[ "$(snapshot_config)" = "$config_before" ] || fail "$user_config changed during the run"
ok

echo "SMOKE OK: opencode $version"
