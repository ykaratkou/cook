/**
 * cook pi extension — the sealed `cook_subagent` spawn tool, the
 * `cook_gate` structured-gate tool, and the six namespaced cook commands.
 *
 * Registers `cook_subagent`, which runs exactly one fresh-context child
 * `pi` process under the cook seal (spec: `.cook/tasks/pi-adapter/spec.md`
 * "Implementation Decisions: cook_subagent"; `docs/spec/10-hosts.md`;
 * `docs/adr/0003`):
 *
 *   pi --mode json -p --no-session --no-extensions --no-skills
 *      --no-context-files --no-prompt-templates
 *      --tools read,bash,edit,write,grep,find,ls
 *
 * The prompt travels on stdin only (`-p` merges piped stdin into the
 * prompt) — never argv (pop's prompt-spill exclusion). No `--model` flag:
 * the child inherits the session default. The tool result is the text of
 * the child's last `message_end` with `role: "assistant"`; stopReason,
 * usage (input/output/cacheRead/cacheWrite/cost.total), exit code, and a
 * bounded stderr tail ride in tool details. Abort sends SIGTERM, then
 * SIGKILL after 5 s. Child failure (non-zero exit, or stopReason
 * `error`/`aborted`) surfaces as an error tool result — in this pi
 * version a tool result is an error iff `execute` throws, so failures
 * throw with text falling back errorMessage → stderr tail → final text.
 *
 * Typecheck mechanism: `@earendil-works/pi-coding-agent` is published on
 * npm, so the dev-only `package.json` + `package-lock.json` beside this
 * file pin it (and `typebox`) purely to resolve pi's real types:
 *
 *   cd pi/extension && npm ci && npx tsc --noEmit
 *
 * At runtime pi itself provides the `@earendil-works/pi-coding-agent` and
 * `typebox` imports to extensions, so nothing here needs installing to run.
 *
 * Second slice — gates and commands (spec "Implementation Decisions:
 * cook_gate, commands"; `docs/adr/0007` extension-registered namespaced
 * commands; `docs/adr/0004` attended-only gates):
 *
 * - `cook_gate` maps `{ kind: select | confirm | input, title, options?,
 *   message?, placeholder? }` onto `ctx.ui.select` / `ctx.ui.confirm` /
 *   `ctx.ui.input`. With no UI (`--mode json`, `-p`) it errors: gates are
 *   attended-only, never defaulted. A dismissed select/input (undefined)
 *   errors too — a dismissal is not an answer.
 * - Commands `cook:drain|plan|register|status|verify|review` (colon names
 *   verified to register and dispatch in pi 0.84.2) each inject one user
 *   message: per-verb framing mirroring `claude-code/commands/*.md`, an
 *   instruction to read the mapped skill file at its runtime-resolved
 *   absolute path, the user's arguments, and a trailer with the resolved
 *   prompts dir, skills dir, pi delivery note, and this session's id (the
 *   orchestrator records it as the lock's `session` field). All paths
 *   derive from `import.meta.url` at invocation — nothing is baked at
 *   authoring time.
 *
 * Third slice — agent_settled drain-loop hardening (optional; correctness
 * never depends on it — `docs/spec/10-hosts.md` loop-hardening row).
 * Mirrors `claude-code/hooks/stop-drain-guard.sh`: when the agent settles
 * while a fresh `drain.lock` (mtime within 10 minutes) exists at
 * `.cook/tasks/*\/drain.lock` under the session cwd **and its recorded
 * `session` field equals this session's `getSessionId()`**, re-inject the
 * continue-the-drain instruction via `pi.sendUserMessage`. Other sessions'
 * locks never nag here — the hardening is scoped to the orchestrator
 * session (unmatchable locks forfeit hardening only). Bounded like
 * `stop_hook_active`: never inject twice in a row — the flag re-arms only
 * on genuine user input (the `input` event with a non-"extension" source),
 * so a wandering drain becomes the human's `/cook:drain` re-entry, by
 * design. Never fires while a `cook_gate` dialog is pending or the agent
 * is not idle (`ctx.isIdle()` guard).
 *
 * Fourth slice — Subagent trace visibility (`docs/spec/10-hosts.md`'s
 * trace-visibility row, declared **Human-facing**: the audience is the human
 * and no cook logic may rely on it — ADR-0009). Claude Code shows a
 * subagent's turns natively (`/tasks`, per-session `subagents/*.jsonl`); a
 * child process has no such view, so this adapter supplies one:
 *
 * - the child's `--mode json` stream also carries `tool_execution_*` and
 *   `tool_result_end` (pi `docs/json.md`), so `consumeLine` accumulates a
 *   bounded step list alongside the final message;
 * - `onUpdate` pushes that list while the child runs, and
 *   `renderCall`/`renderResult` draw it — collapsed to a status line, or
 *   expanded to every step plus the final message;
 * - every raw stdout line is teed to a **Subagent trace** under pi's own
 *   agent dir (`getAgentDir()/cook/subagents/<session>/`), never under
 *   `.cook/`: doc 01's storage contract describes cook's records, and a
 *   trace is the host's artifact. Raw, so pi's own `jq` recipes replay it.
 *
 * Three invariants hold this slice in place. `content[]` is untouched — the
 * result text stays the child's final assistant message, because the drain
 * skills parse it for sentinels / VERDICT / the review body, and a trace must
 * never reach the orchestrator's context. Every filesystem touch is
 * best-effort: a trace that cannot be written degrades to no trace and never
 * fails a run. And because a thrown tool result carries no `details`, the
 * three failure throws name the trace path in their message text, so the
 * path survives exactly the runs a human most wants to read.
 *
 * The seal is deliberately NOT reopened for this: `--session-dir` would give
 * a resumable child session, a richer artifact, at the cost of the
 * headless-sealing guarantee. The event stream carries the same information.
 */

import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
	AgentToolResult,
	AgentToolUpdateCallback,
	ExtensionAPI,
	Theme,
} from "@earendil-works/pi-coding-agent";
import { getAgentDir, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

/** The seal: exact child argv, nothing more, nothing less. No --model. */
const SEAL_ARGV: readonly string[] = [
	"--mode",
	"json",
	"-p",
	"--no-session",
	"--no-extensions",
	"--no-skills",
	"--no-context-files",
	"--no-prompt-templates",
	"--tools",
	"read,bash,edit,write,grep,find,ls",
];

const STDERR_TAIL_MAX_BYTES = 8 * 1024;
const SIGKILL_DELAY_MS = 5000;

/**
 * Trace bounds. The step list is a *display* artifact — the archive is the
 * raw JSONL file, which is never truncated — so it is capped hard: a runaway
 * child must not grow the orchestrator's render tree without limit.
 */
const TRACE_MAX_STEPS = 200;
const TRACE_ARG_PREVIEW_CHARS = 80;
const TRACE_TEXT_PREVIEW_CHARS = 300;

/** Traces older than this are pruned, best-effort, on the next spawn. */
const TRACE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

/** One step of a subagent's run, as shown to the human. */
type TraceStep =
	| { kind: "tool"; callId?: string; name: string; preview: string; isError?: boolean }
	| { kind: "text"; text: string };

interface SubagentUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
}

/**
 * Structured details attached to a cook_subagent result. Everything here is
 * for the renderers and the human; nothing in cook reads it (ADR-0009).
 */
interface CookSubagentDetails {
	exitCode: number | null;
	stopReason?: string;
	usage: SubagentUsage;
	stderrTail: string;
	aborted: boolean;
	/** The run's steps, bounded by TRACE_MAX_STEPS. */
	trace: TraceStep[];
	/** How many steps were dropped by that bound. */
	traceDropped: number;
	/** Absolute path of the raw JSONL trace, or undefined if none was written. */
	tracePath?: string;
	/** The child's final assistant text, so the renderer need not re-derive it. */
	finalText?: string;
}

/** Wire shapes for the slice of pi's `--mode json` JSONL stream we read. */
interface WireContentPart {
	type?: string;
	text?: string;
}
interface WireUsage {
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
	cost?: { total?: number };
}
interface WireMessage {
	role?: string;
	content?: WireContentPart[];
	usage?: WireUsage;
	stopReason?: string;
	errorMessage?: string;
}
interface WireEvent {
	type?: string;
	message?: WireMessage;
	/** tool_execution_* only. */
	toolCallId?: string;
	toolName?: string;
	args?: unknown;
	isError?: boolean;
}

// ---------------------------------------------------------------------------
// The Subagent trace sink.
//
// A trace lives under pi's own agent dir, never under `.cook/` — doc 01's
// storage contract describes cook's records, and this is the host's artifact
// (ADR-0009). Every operation is best-effort by construction: `TraceSink`
// swallows its own failures and reports `path === undefined`, so a read-only
// home directory or a full disk costs the human a trace and costs the drain
// nothing.
// ---------------------------------------------------------------------------

/** Root of every cook trace on this machine. */
function tracesRoot(): string {
	return join(getAgentDir(), "cook", "subagents");
}

/** `2026-08-21T10-42-07-123Z` — filename-safe, sorts chronologically. */
function traceStamp(): string {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Drop trace directories older than the retention window. Nothing outside the
 * repo is cleaned up by anything else, so the sink prunes on its own spawn.
 * Wholly best-effort: any failure just leaves the files in place.
 */
function pruneOldTraces(): void {
	const root = tracesRoot();
	let entries: string[];
	try {
		entries = readdirSync(root);
	} catch {
		return; // no traces yet, or the dir is unreadable
	}
	const cutoff = Date.now() - TRACE_RETENTION_MS;
	for (const entry of entries) {
		const dir = join(root, entry);
		try {
			if (statSync(dir).mtimeMs < cutoff) rmSync(dir, { recursive: true, force: true });
		} catch {
			// leave it; a trace that will not delete is not a problem worth raising
		}
	}
}

/**
 * An append-only sink for one child's raw stdout. Opened lazily on the first
 * byte, so a child that produces nothing leaves no empty file behind.
 */
class TraceSink {
	/** The trace's path once a byte has been written, else undefined. */
	path: string | undefined;
	private fd: number | undefined;
	private failed = false;

	constructor(private readonly sessionId: string) {}

	/** Append raw bytes. Never throws; the first failure disables the sink. */
	write(chunk: string): void {
		if (this.failed) return;
		try {
			if (this.fd === undefined) {
				const dir = join(tracesRoot(), this.sessionId || "unknown-session");
				mkdirSync(dir, { recursive: true });
				const path = join(dir, `${traceStamp()}.jsonl`);
				this.fd = openSync(path, "a");
				this.path = path;
			}
			writeSync(this.fd, chunk);
		} catch {
			this.failed = true;
			this.path = undefined;
			this.closeQuietly();
		}
	}

	/** Write the stderr tail beside the trace, only when there is one. */
	writeStderrTail(tail: string): void {
		if (!tail || !this.path) return;
		try {
			const fd = openSync(`${this.path}.stderr.txt`, "a");
			try {
				writeSync(fd, tail);
			} finally {
				closeSync(fd);
			}
		} catch {
			// the trace itself is what matters
		}
	}

	close(): void {
		this.closeQuietly();
	}

	private closeQuietly(): void {
		if (this.fd === undefined) return;
		try {
			closeSync(this.fd);
		} catch {
			// nothing useful to do with a failed close
		}
		this.fd = undefined;
	}
}

/** Collapse a value to one short single-line preview for a step line. */
function previewArgs(args: unknown): string {
	if (args === undefined || args === null) return "";
	let text: string;
	if (typeof args === "string") {
		text = args;
	} else if (typeof args === "object") {
		// Prefer the field a reader actually wants: what was it applied to?
		const record = args as Record<string, unknown>;
		const salient = record.path ?? record.file_path ?? record.pattern ?? record.command ?? record.query;
		text = typeof salient === "string" ? salient : JSON.stringify(args);
	} else {
		text = String(args);
	}
	text = text.replace(/\s+/g, " ").trim();
	return text.length > TRACE_ARG_PREVIEW_CHARS ? `${text.slice(0, TRACE_ARG_PREVIEW_CHARS)}\u2026` : text;
}

/** First `content[]` part of type "text", or "". */
function firstTextPart(message: WireMessage | undefined): string {
	for (const part of message?.content ?? []) {
		if (part.type === "text" && typeof part.text === "string") return part.text;
	}
	return "";
}

interface ChildOutcome {
	exitCode: number | null;
	finalAssistant: WireMessage | undefined;
	usage: SubagentUsage;
	stderrTail: string;
	aborted: boolean;
	spawnError?: Error;
	/** The run's steps, for the human (bounded by TRACE_MAX_STEPS). */
	trace: TraceStep[];
	traceDropped: number;
}

/**
 * Spawn one sealed child, deliver the prompt on stdin, stream-parse the
 * JSONL stdout, and settle when the process closes. Never rejects — every
 * outcome (including spawn failure and abort) resolves so the caller can
 * shape the tool result.
 *
 * Every raw stdout chunk is also teed to `sink` (the Subagent trace), and
 * `onProgress` fires after each accumulated step so the caller can stream an
 * update. Both are for the human: neither affects what the tool returns.
 */
function runSealedChild(
	prompt: string,
	cwd: string,
	signal: AbortSignal | undefined,
	sink: TraceSink,
	onProgress: (outcome: ChildOutcome) => void,
): Promise<ChildOutcome> {
	return new Promise((resolve) => {
		const usage: SubagentUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
		let finalAssistant: WireMessage | undefined;
		let stderrTail = "";
		let aborted = false;
		let spawnError: Error | undefined;
		let stdoutBuffer = "";
		let killTimer: ReturnType<typeof setTimeout> | undefined;
		const trace: TraceStep[] = [];
		let traceDropped = 0;

		/** Append one step, honouring the display bound. */
		const pushStep = (step: TraceStep): void => {
			if (trace.length >= TRACE_MAX_STEPS) {
				traceDropped += 1;
				return;
			}
			trace.push(step);
		};

		const snapshot = (): ChildOutcome => ({
			exitCode: null,
			finalAssistant,
			usage,
			stderrTail,
			aborted,
			trace,
			traceDropped,
		});

		const child = spawn("pi", [...SEAL_ARGV], {
			cwd,
			shell: false,
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Prompt on stdin only — never a positional argv argument.
		child.stdin.on("error", () => {
			/* child exited before consuming stdin; close handler reports it */
		});
		child.stdin.end(prompt);

		const consumeLine = (line: string): void => {
			if (!line.trim()) return;
			let event: WireEvent;
			try {
				event = JSON.parse(line) as WireEvent;
			} catch {
				return; // non-JSON noise on stdout is ignored
			}

			// The trace half: the events the result deliberately ignores are
			// exactly the ones a human wants (pi `docs/json.md`).
			if (event.type === "tool_execution_start" && event.toolName) {
				pushStep({
					kind: "tool",
					callId: event.toolCallId,
					name: event.toolName,
					preview: previewArgs(event.args),
				});
				onProgress(snapshot());
				return;
			}
			if (event.type === "tool_execution_end") {
				if (event.isError && event.toolCallId) {
					// Mark the step this result belongs to, newest match first.
					for (let i = trace.length - 1; i >= 0; i -= 1) {
						const step = trace[i];
						if (step.kind === "tool" && step.callId === event.toolCallId) {
							step.isError = true;
							break;
						}
					}
				}
				onProgress(snapshot());
				return;
			}

			if (event.type !== "message_end" || !event.message) return;
			const message = event.message;
			if (message.role !== "assistant") return;
			finalAssistant = message; // last assistant message_end wins
			const u = message.usage;
			if (u) {
				usage.input += u.input ?? 0;
				usage.output += u.output ?? 0;
				usage.cacheRead += u.cacheRead ?? 0;
				usage.cacheWrite += u.cacheWrite ?? 0;
				usage.cost += u.cost?.total ?? 0;
			}
			// The child's narration between tool calls, kept short: the final
			// message is rendered in full separately, this is the running story.
			const said = firstTextPart(message).trim();
			if (said) {
				pushStep({
					kind: "text",
					text: said.length > TRACE_TEXT_PREVIEW_CHARS ? `${said.slice(0, TRACE_TEXT_PREVIEW_CHARS)}\u2026` : said,
				});
			}
			onProgress(snapshot());
		};

		child.stdout.on("data", (chunk: Buffer) => {
			const text = chunk.toString("utf8");
			sink.write(text); // raw, unparsed: pi's own jq recipes must replay it
			stdoutBuffer += text;
			const lines = stdoutBuffer.split("\n");
			stdoutBuffer = lines.pop() ?? "";
			for (const line of lines) consumeLine(line);
		});

		child.stderr.on("data", (chunk: Buffer) => {
			// Keep only a bounded tail.
			stderrTail = (stderrTail + chunk.toString("utf8")).slice(-STDERR_TAIL_MAX_BYTES);
		});

		const onAbort = (): void => {
			aborted = true;
			child.kill("SIGTERM");
			killTimer = setTimeout(() => {
				if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
			}, SIGKILL_DELAY_MS);
			killTimer.unref();
		};
		if (signal) {
			if (signal.aborted) onAbort();
			else signal.addEventListener("abort", onAbort, { once: true });
		}

		child.on("error", (error) => {
			spawnError = error; // 'close' still fires after 'error'
		});

		child.on("close", (code) => {
			if (stdoutBuffer.trim()) consumeLine(stdoutBuffer); // flush trailing buffer
			signal?.removeEventListener("abort", onAbort);
			if (killTimer !== undefined) clearTimeout(killTimer);
			sink.writeStderrTail(stderrTail);
			sink.close();
			resolve({ exitCode: code, finalAssistant, usage, stderrTail, aborted, spawnError, trace, traceDropped });
		});
	});
}

// ---------------------------------------------------------------------------
// Runtime path resolution — never baked at authoring time.
// This file lives at <checkout>/pi/extension/index.ts, so the cook checkout
// root is two directories up from the compiled module's own location.
// ---------------------------------------------------------------------------

/** Absolute cook checkout root, resolved from this file's location. */
function cookRoot(): string {
	return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

interface CookPaths {
	root: string;
	promptsDir: string;
	skillsDir: string;
	deliveryNote: string;
	/**
	 * This session's id (`ctx.sessionManager.getSessionId()`), injected so
	 * the orchestrator can record it as the lock's `session` field — the
	 * agent_settled hardening only nags the session whose id the lock holds.
	 */
	sessionId: string;
}

/** All runtime-resolved absolute paths (plus session id) the commands inject. */
function cookPaths(sessionId: string): CookPaths {
	const root = cookRoot();
	const skillsDir = join(root, "skills");
	return {
		root,
		promptsDir: join(root, "prompts"),
		skillsDir,
		deliveryNote: join(skillsDir, "drain", "references", "host-pi.md"),
		sessionId,
	};
}

// ---------------------------------------------------------------------------
// The six cook commands. Each injects one user message: per-verb framing
// (mirroring claude-code/commands/*.md), an instruction to read the mapped
// skill file at its runtime-resolved absolute path, the user's arguments,
// and the shared paths trailer.
// ---------------------------------------------------------------------------

interface CookCommandSpec {
	/** Registered command name (colon-namespaced; see header note). */
	name: string;
	/** Shown in pi's command list. */
	description: string;
	/** Builds the injected user message from the runtime paths and args. */
	build(paths: CookPaths, args: string): string;
}

/** The trailer every cook command message ends with. */
function pathsTrailer(paths: CookPaths): string {
	return [
		"--- cook runtime paths (resolved by the pi extension at invocation) ---",
		`cook checkout root: ${paths.root}`,
		`shared prompts dir: ${paths.promptsDir}`,
		`shared skills dir: ${paths.skillsDir}`,
		`host delivery note (capability -> mechanism on pi): ${paths.deliveryNote}`,
		`session identifier for drain.lock: ${paths.sessionId}`,
	].join("\n");
}

function argLine(label: string, args: string): string {
	return `${label}: ${args.trim() || "(none given)"}`;
}

const COOK_COMMANDS: CookCommandSpec[] = [
	{
		name: "cook:drain",
		description:
			"Drain a cook task set: run the implement loop over its eligible AFK tasks, " +
			"verify, review, and stop at human gates. No argument selects the highest-priority READY set.",
		build: (paths, args) =>
			[
				"You are now the cook drain orchestrator. Read",
				`\`${join(paths.skillsDir, "drain", "SKILL.md")}\` in full and follow`,
				"it exactly. It is the instruction set for the whole Implement run — set",
				"selection, the drain loop, attempts, verification, review, and gates.",
				"",
				argLine("Set argument", args),
				"",
				"An empty argument means: select the set by the derivation in the skill's",
				"`references/status.md` (highest-priority READY set).",
				"",
				pathsTrailer(paths),
			].join("\n"),
	},
	{
		name: "cook:plan",
		description:
			"Author a cook task set for a feature: interview (grill), spec, decompose " +
			"into tickets, then self-validate until the set derives READY.",
		build: (paths, args) =>
			[
				`Read \`${join(paths.skillsDir, "plan", "SKILL.md")}\` in full and`,
				"follow it. It orchestrates the companion skills (grill-with-docs → to-spec →",
				"to-tickets) and self-validates the resulting task set against the format",
				"contract until it derives READY.",
				"",
				argLine("Feature to plan", args),
				"",
				pathsTrailer(paths),
			].join("\n"),
	},
	{
		name: "cook:register",
		description:
			"Validate a hand-authored or hand-edited cook task set against the format " +
			"contract; print the fix list, or READY.",
		build: (paths, args) =>
			[
				`Read \`${join(paths.skillsDir, "register", "SKILL.md")}\` in full and`,
				"follow it. Validate the named set against the format contract and report",
				"either READY or the ordered fix list. Registration never drains and never",
				"edits task state on its own.",
				"",
				argLine("Set to validate", args),
				"",
				pathsTrailer(paths),
			].join("\n"),
	},
	{
		name: "cook:status",
		description:
			"Derive and print every cook task set's status and open tasks. Read-only: " +
			"no verifier spawn, no state change.",
		build: (paths, args) =>
			[
				`Read \`${join(paths.skillsDir, "drain", "references", "status.md")}\` and`,
				"apply it to every set directory under `.cook/tasks/`.",
				"",
				"This command is **read-only and side-effect-free**: derive each set's status",
				"from its files, print one line per set (set id, derived status, verification",
				"mark in the terminal zone — including `verified at <sha>` when HEAD has moved",
				"past the verified SHA), then list each set's open tasks. Where a review",
				"document exists, print the review pointer (path, commit written against,",
				"out-of-date flag) — never the review body.",
				"",
				"Do not run the Verifier, do not spawn anything, do not write any file. A",
				"cache miss displays as NEEDS-VERIFY; deciding to verify belongs to the drain.",
				"",
				argLine("User arguments", args),
				"",
				pathsTrailer(paths),
			].join("\n"),
	},
	{
		name: "cook:verify",
		description:
			"Force the cook Verifier on a task set now, outside the automatic flow. " +
			"Ignores any cached verdict.",
		build: (paths, args) =>
			[
				`Read \`${join(paths.skillsDir, "drain", "references", "verify.md")}\` and`,
				"run its **force mode** for the named set: always spawn a fresh Verifier,",
				"regardless of any cached verdict (the cache governs only automatic runs).",
				"Record and report the verdict per that document. Prompt rendering rules are",
				`in \`${join(paths.skillsDir, "drain", "SKILL.md")}\`.`,
				"",
				argLine("Set to verify", args),
				"",
				pathsTrailer(paths),
			].join("\n"),
	},
	{
		name: "cook:review",
		description:
			"Force the cook Reviewer on a task set now, outside the automatic flow. " +
			"Writes a fresh non-gating review document.",
		build: (paths, args) =>
			[
				`Read \`${join(paths.skillsDir, "drain", "references", "review.md")}\` and`,
				"run its **force mode** for the named set: always write a fresh review,",
				"ignoring the review episode fingerprint. The review gates nothing; report the",
				"review pointer (path, commit, out-of-date flag), never inline the body.",
				"Prompt rendering rules are in",
				`\`${join(paths.skillsDir, "drain", "SKILL.md")}\`.`,
				"",
				argLine("Set to review", args),
				"",
				pathsTrailer(paths),
			].join("\n"),
	},
];

// ---------------------------------------------------------------------------
// agent_settled drain-loop hardening — helpers.
// Optional; correctness never depends on it (spec 10-hosts). The scan and
// the instruction text mirror claude-code/hooks/stop-drain-guard.sh.
// ---------------------------------------------------------------------------

/** A drain.lock is "fresh" within this window (the hook's `-mmin -10`). */
const DRAIN_LOCK_FRESH_MS = 10 * 60 * 1000;

interface FreshDrainLock {
	lockPath: string;
	setId: string;
}

/**
 * First fresh `drain.lock` at `.cook/tasks/<set>/drain.lock` under `cwd`
 * (mtime within 10 minutes) whose recorded `session` field equals
 * `sessionId` — i.e. a lock THIS session's orchestrator wrote — or
 * undefined. Directory order is sorted for determinism; missing dirs,
 * missing locks, unparseable locks, and other sessions' locks are all
 * simply "no lock": the hardening nags only on a positive identity match
 * (it is optional by spec 10 — a false nag in an unrelated session is the
 * failure mode being scoped out).
 */
function findOwnFreshDrainLock(
	cwd: string,
	sessionId: string,
): FreshDrainLock | undefined {
	const tasksDir = join(cwd, ".cook", "tasks");
	let entries: string[];
	try {
		entries = readdirSync(tasksDir).sort();
	} catch {
		return undefined; // no .cook/tasks under this cwd
	}
	for (const setId of entries) {
		const lockPath = join(tasksDir, setId, "drain.lock");
		try {
			if (Date.now() - statSync(lockPath).mtimeMs >= DRAIN_LOCK_FRESH_MS) {
				continue; // stale — a crashed drain, not a live one
			}
			const lock: unknown = JSON.parse(readFileSync(lockPath, "utf8"));
			const session =
				typeof lock === "object" && lock !== null && "session" in lock
					? (lock as { session: unknown }).session
					: undefined;
			if (session === sessionId) {
				return { lockPath, setId };
			}
		} catch {
			// this set holds no lock, or the lock is unreadable/unparseable —
			// either way it cannot be positively ours
		}
	}
	return undefined;
}

/** The continue-the-drain instruction, adapted from the stop hook. */
function drainContinueMessage(lock: FreshDrainLock): string {
	return [
		`A fresh drain lock exists at ${lock.lockPath} (set: ${lock.setId}), and its session`,
		"identifier is this session's, so your cook drain appears to be mid-flight.",
		"Continue the drain loop — re-derive the set's status from its files and run",
		"the next iteration; do not end your turn while the set derives READY and no",
		"gate is open. If the drain has in fact reached an exit path, remove the",
		"stale lock and report the disposition.",
	].join("\n");
}

// ---------------------------------------------------------------------------
// Trace presentation. Everything below draws for the human only (ADR-0009);
// none of it touches the tool result's `content[]`.
// ---------------------------------------------------------------------------

/** Build the result details from an outcome plus whatever the sink managed. */
function detailsOf(outcome: ChildOutcome, sink: TraceSink, finalText: string): CookSubagentDetails {
	return {
		exitCode: outcome.exitCode,
		stopReason: outcome.finalAssistant?.stopReason,
		usage: outcome.usage,
		stderrTail: outcome.stderrTail,
		aborted: outcome.aborted,
		trace: [...outcome.trace],
		traceDropped: outcome.traceDropped,
		tracePath: sink.path,
		finalText: finalText || undefined,
	};
}

/** `" (trace: /path)"`, or "" when no trace was written. */
function traceSuffix(sink: TraceSink): string {
	return sink.path ? ` (trace: ${sink.path})` : "";
}

/**
 * `~`-relative form of a path under the home directory. A trace path is ~90
 * characters; inside an indented render block it wraps flush-left and reads as
 * broken, and the home prefix is the part a human never needs to see.
 */
function displayPath(path: string): string {
	const home = process.env.HOME;
	return home && path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

/** One-line progress text for a streaming update. */
function latestStepLine(trace: TraceStep[]): string {
	const last = trace[trace.length - 1];
	if (!last) return "(running\u2026)";
	return last.kind === "tool" ? `${last.name} ${last.preview}`.trim() : last.text;
}

/** `12.4k in / 3.1k out / $0.03` — compact enough for a header line. */
function formatUsage(usage: SubagentUsage): string {
	const round = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
	const parts = [`${round(usage.input)} in`, `${round(usage.output)} out`];
	if (usage.cost > 0) parts.push(`$${usage.cost.toFixed(4)}`);
	return parts.join(" / ");
}

/** One step as a themed line: `\u2192 read path/to/file` or a text preview. */
function renderStep(step: TraceStep, theme: Theme): string {
	if (step.kind === "text") return theme.fg("toolOutput", step.text);
	const arrow = step.isError ? theme.fg("error", "\u2717") : theme.fg("muted", "\u2192");
	return `${arrow} ${theme.fg("accent", step.name)}${step.preview ? theme.fg("dim", ` ${step.preview}`) : ""}`;
}

export default function cookExtension(pi: ExtensionAPI): void {
	// agent_settled drain-loop hardening state (see header, third slice).
	// `drainNudgeSent` mirrors the stop hook's `stop_hook_active` bound:
	// once a settle has injected the continue instruction, later settles
	// pass until genuine user input re-arms it — never inject twice in a
	// row. `gateDialogsPending` counts open cook_gate dialogs; the
	// hardening never fires while one is awaiting the human.
	let drainNudgeSent = false;
	let gateDialogsPending = 0;

	pi.on("input", async (event) => {
		// Genuine user input re-arms the hardening. Our own injected
		// message arrives here too (source "extension") and must not.
		if (event.source !== "extension") drainNudgeSent = false;
		return { action: "continue" };
	});

	pi.on("agent_settled", async (_event, ctx) => {
		if (!ctx.isIdle()) return; // another extension already started a new run
		if (gateDialogsPending > 0) return; // a cook_gate dialog is pending
		if (drainNudgeSent) return; // bounded: the human re-enters via /cook:drain
		const lock = findOwnFreshDrainLock(
			ctx.cwd,
			ctx.sessionManager.getSessionId(),
		);
		if (!lock) return; // no fresh drain.lock of OURS — nothing to nudge
		drainNudgeSent = true;
		pi.sendUserMessage(drainContinueMessage(lock));
	});

	pi.registerTool({
		name: "cook_subagent",
		label: "Cook subagent",
		description: [
			"Run one sealed, fresh-context subagent: spawns a child pi process",
			"(no session, no extensions, no skills, no context files, no prompt",
			"templates; tools read,bash,edit,write,grep,find,ls; model inherited)",
			"with the prompt delivered on stdin, and returns the child's final",
			"assistant message text. Use cook_subagent for cook Attempt, Verifier,",
			"and Reviewer runs so each gets pop-grade isolation.",
		].join(" "),
		parameters: Type.Object({
			prompt: Type.String({ description: "Full prompt for the sealed fresh-context child agent." }),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			pruneOldTraces(); // best-effort; nothing else ever cleans these up
			const sink = new TraceSink(ctx.sessionManager.getSessionId());

			const outcome = await runSealedChild(params.prompt, ctx.cwd, signal, sink, (partial) => {
				// Stream the run to the human. The content text is what pi shows
				// if no renderer is available; the details are what renderResult
				// draws. Neither reaches the orchestrator's context.
				onUpdate?.({
					content: [{ type: "text", text: latestStepLine(partial.trace) }],
					details: detailsOf(partial, sink, ""),
				});
			});

			const stopReason = outcome.finalAssistant?.stopReason;
			const finalText = firstTextPart(outcome.finalAssistant);
			const details = detailsOf(outcome, sink, finalText);

			// In this pi version, a tool result is an error iff execute throws;
			// the thrown message becomes the error result's text. A throw carries
			// no details, so the trace path — most wanted on exactly these runs —
			// rides in the message instead.
			if (outcome.aborted) {
				throw new Error(
					`cook_subagent aborted (SIGTERM${outcome.exitCode === null ? ", SIGKILL" : ""}; ` +
						`exit ${outcome.exitCode ?? "none"}${stopReason ? `, stopReason ${stopReason}` : ""})` +
						traceSuffix(sink),
				);
			}
			if (outcome.spawnError) {
				// The child never ran: no attempt is charged (orchestrator rule —
				// lives in the skills, not here).
				throw new Error(
					`cook_subagent could not spawn pi: ${outcome.spawnError.message}${traceSuffix(sink)}`,
				);
			}
			const failed = outcome.exitCode !== 0 || stopReason === "error" || stopReason === "aborted";
			if (failed) {
				const text =
					outcome.finalAssistant?.errorMessage || outcome.stderrTail || finalText || "(no output)";
				throw new Error(
					`cook_subagent failed (exit ${outcome.exitCode ?? "none"}, ` +
						`stopReason ${stopReason ?? "unknown"}): ${text}${traceSuffix(sink)}`,
				);
			}

			return {
				// Unchanged, and it must stay unchanged: the drain skills parse
				// this text for sentinels / VERDICT / the review body. The trace
				// lives in details only.
				content: [{ type: "text", text: finalText || "(no output)" }],
				details,
			};
		},

		renderCall(args, theme, _context) {
			const prompt = (args.prompt ?? "").replace(/\s+/g, " ").trim();
			const preview = prompt.length > 72 ? `${prompt.slice(0, 72)}\u2026` : prompt || "\u2026";
			return new Text(
				`${theme.fg("toolTitle", theme.bold("cook subagent"))}\n  ${theme.fg("dim", preview)}`,
				0,
				0,
			);
		},

		renderResult(result, { expanded }, theme, _context) {
			// registerTool infers TDetails from execute, but the renderer is typed
			// against AgentToolResult<unknown>; narrow it here as pi's own
			// subagent example does.
			const details = result.details as CookSubagentDetails | undefined;
			if (!details) {
				// A thrown result carries no details; show pi what it has.
				const first = result.content[0];
				return new Text(first?.type === "text" ? first.text : "(no output)", 0, 0);
			}

			// A streaming update reports exitCode null: still running, not failed.
			const running = details.exitCode === null && !details.aborted;
			const isError =
				!running &&
				(details.aborted ||
					details.exitCode !== 0 ||
					details.stopReason === "error" ||
					details.stopReason === "aborted");
			const glyph = running
				? theme.fg("muted", "\u2026")
				: isError
					? theme.fg("error", "\u2717")
					: theme.fg("success", "\u2713");
			const steps = details.trace.filter((step: TraceStep) => step.kind === "tool").length;
			const header =
				`${glyph} ${theme.fg("toolTitle", theme.bold("cook subagent"))} ` +
				theme.fg("muted", `${steps} ${steps === 1 ? "step" : "steps"}`) +
				theme.fg("dim", ` \u00b7 ${formatUsage(details.usage)}`);

			const container = new Container();
			container.addChild(new Text(header, 0, 0));
			if (details.tracePath) {
				// Unindented and on its own line: a path long enough to wrap should
				// wrap against the margin, not against a phantom indent.
				container.addChild(new Text(theme.fg("dim", displayPath(details.tracePath)), 0, 0));
			}

			// Collapsed shows the tail; expanded shows the whole run.
			const shown = expanded ? details.trace : details.trace.slice(-3);
			const elided = details.trace.length - shown.length + details.traceDropped;
			if (elided > 0) {
				container.addChild(new Text(theme.fg("muted", `  \u2026 ${elided} earlier steps`), 0, 0));
			}
			for (const step of shown) {
				container.addChild(new Text(`  ${renderStep(step, theme)}`, 0, 0));
			}

			if (expanded) {
				if (details.finalText) {
					container.addChild(new Spacer(1));
					container.addChild(new Markdown(details.finalText.trim(), 0, 0, getMarkdownTheme()));
				}
				if (details.stderrTail.trim()) {
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "\u2500\u2500\u2500 stderr \u2500\u2500\u2500"), 0, 0));
					container.addChild(new Text(theme.fg("error", details.stderrTail.trimEnd()), 0, 0));
				}
			}
			return container;
		},
	});

	pi.registerTool({
		name: "cook_gate",
		label: "Cook gate",
		description: [
			"Ask the human at a cook gate via a structured dialog and return their",
			"answer verbatim. kind=select shows title + options (returns the chosen",
			'option), kind=confirm shows title + message (returns "yes" or "no"),',
			"kind=input shows title + placeholder (returns the typed text). Gates",
			"are attended-only (ADR-0004): with no UI this tool returns an error —",
			"park the set and exit with the disposition; never invent an answer. A",
			"dismissed dialog is also an error, not an answer: re-ask or park.",
		].join(" "),
		parameters: Type.Object({
			kind: Type.Union([Type.Literal("select"), Type.Literal("confirm"), Type.Literal("input")], {
				description: "Dialog kind: select (pick one option), confirm (yes/no), input (free text).",
			}),
			title: Type.String({ description: "Dialog title — the question being asked." }),
			options: Type.Optional(
				Type.Array(Type.String(), {
					description: "select only: the gate's allowed outcomes, one per option.",
				}),
			),
			message: Type.Optional(Type.String({ description: "confirm only: the confirmation body text." })),
			placeholder: Type.Optional(Type.String({ description: "input only: placeholder text for the field." })),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				// json / print mode: no human is attached. ADR-0004 — gates are
				// attended-only. This must surface as an error result so the
				// orchestrator parks the set and exits with the disposition; a
				// defaulted answer must be impossible.
				throw new Error(
					"cook_gate: no UI in this session — gates are attended-only (ADR-0004). " +
						"This is not an answer. Park the set and exit with the disposition.",
				);
			}

			// While the dialog awaits the human, the agent_settled hardening
			// must stay silent (see header, third slice).
			gateDialogsPending += 1;
			try {
				switch (params.kind) {
					case "select": {
						const options = params.options ?? [];
						if (options.length === 0) {
							throw new Error('cook_gate: kind "select" requires a non-empty options array.');
						}
						const answer = await ctx.ui.select(params.title, [...options]);
						if (answer === undefined) {
							throw new Error("cook_gate: dismissed — re-ask or park; not an answer.");
						}
						return { content: [{ type: "text", text: answer }], details: { kind: params.kind } };
					}
					case "confirm": {
						const confirmed = await ctx.ui.confirm(params.title, params.message ?? "");
						return { content: [{ type: "text", text: confirmed ? "yes" : "no" }], details: { kind: params.kind } };
					}
					case "input": {
						const answer = await ctx.ui.input(params.title, params.placeholder);
						if (answer === undefined) {
							throw new Error("cook_gate: dismissed — re-ask or park; not an answer.");
						}
						return { content: [{ type: "text", text: answer }], details: { kind: params.kind } };
					}
				}
			} finally {
				gateDialogsPending -= 1;
			}
		},
	});

	for (const command of COOK_COMMANDS) {
		pi.registerCommand(command.name, {
			description: command.description,
			handler: async (args, ctx) => {
				// Paths resolve at invocation, from this module's own location;
				// the session id rides along for the lock's `session` field.
				const message = command.build(
					cookPaths(ctx.sessionManager.getSessionId()),
					args,
				);
				// sendUserMessage requires deliverAs while the agent is streaming.
				pi.sendUserMessage(message, ctx.isIdle() ? undefined : { deliverAs: "followUp" });
			},
		});
	}
}
