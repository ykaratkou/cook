/**
 * cook pi extension — first slice: the sealed `cook_subagent` spawn tool.
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
 */

import { spawn } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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

interface SubagentUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
}

/** Structured details attached to a successful cook_subagent result. */
interface CookSubagentDetails {
	exitCode: number | null;
	stopReason?: string;
	usage: SubagentUsage;
	stderrTail: string;
	aborted: boolean;
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
}

/**
 * Spawn one sealed child, deliver the prompt on stdin, stream-parse the
 * JSONL stdout, and settle when the process closes. Never rejects — every
 * outcome (including spawn failure and abort) resolves so the caller can
 * shape the tool result.
 */
function runSealedChild(prompt: string, cwd: string, signal: AbortSignal | undefined): Promise<ChildOutcome> {
	return new Promise((resolve) => {
		const usage: SubagentUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
		let finalAssistant: WireMessage | undefined;
		let stderrTail = "";
		let aborted = false;
		let spawnError: Error | undefined;
		let stdoutBuffer = "";
		let killTimer: ReturnType<typeof setTimeout> | undefined;

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
		};

		child.stdout.on("data", (chunk: Buffer) => {
			stdoutBuffer += chunk.toString("utf8");
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
			resolve({ exitCode: code, finalAssistant, usage, stderrTail, aborted, spawnError });
		});
	});
}

export default function cookExtension(pi: ExtensionAPI): void {
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

		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const outcome = await runSealedChild(params.prompt, ctx.cwd, signal);
			const stopReason = outcome.finalAssistant?.stopReason;
			const finalText = firstTextPart(outcome.finalAssistant);
			const details: CookSubagentDetails = {
				exitCode: outcome.exitCode,
				stopReason,
				usage: outcome.usage,
				stderrTail: outcome.stderrTail,
				aborted: outcome.aborted,
			};

			// In this pi version, a tool result is an error iff execute throws;
			// the thrown message becomes the error result's text.
			if (outcome.aborted) {
				throw new Error(
					`cook_subagent aborted (SIGTERM${outcome.exitCode === null ? ", SIGKILL" : ""}; ` +
						`exit ${outcome.exitCode ?? "none"}${stopReason ? `, stopReason ${stopReason}` : ""})`,
				);
			}
			if (outcome.spawnError) {
				// The child never ran: no attempt is charged (orchestrator rule —
				// lives in the skills, not here).
				throw new Error(`cook_subagent could not spawn pi: ${outcome.spawnError.message}`);
			}
			const failed = outcome.exitCode !== 0 || stopReason === "error" || stopReason === "aborted";
			if (failed) {
				const text =
					outcome.finalAssistant?.errorMessage || outcome.stderrTail || finalText || "(no output)";
				throw new Error(
					`cook_subagent failed (exit ${outcome.exitCode ?? "none"}, ` +
						`stopReason ${stopReason ?? "unknown"}): ${text}`,
				);
			}

			return {
				content: [{ type: "text", text: finalText || "(no output)" }],
				details,
			};
		},
	});
}
