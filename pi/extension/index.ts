/**
 * cook pi extension — the `cook_gate` structured-gate tool, the six
 * namespaced cook commands, and the optional drain-loop hardening.
 *
 * Cook does **not** implement subagent spawning on this host. The
 * fresh-context subagent spawn capability is delivered by
 * `@tintinweb/pi-subagents`, a prerequisite package
 * (`docs/adr/0011`; `docs/spec/10-hosts.md`;
 * `skills/drain/references/host-pi.md`). Its `Agent` tool, called with
 * `isolated: true` and `run_in_background: false`, is what cook's skills
 * name for every Attempt, Verifier, and Reviewer run. This extension
 * supplies only the capabilities that package does not: the gate ask, the
 * commands, and the hardening.
 *
 * First slice — gates and commands (`docs/adr/0007` extension-registered
 * namespaced commands; `docs/adr/0004` attended-only gates):
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
 * Second slice — agent_settled drain-loop hardening (optional; correctness
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
 * Third slice — the prerequisite probe. A cook install whose pi has no
 * pi-subagents cannot run an Attempt at all, and the failure would
 * otherwise surface as the model inventing a workaround mid-drain. So each
 * session checks once, over pi-subagents' own discovery surface: its
 * `subagents:ready` announcement, plus a `subagents:rpc:ping` for the case
 * where it wired its handlers before cook's `session_start` ran. Neither
 * answering is reported to the human with the install command, once, as a
 * warning — never as an error: `/cook:status` and `/cook:register` need no
 * subagent, and a human reading a set is not doing anything wrong.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ---------------------------------------------------------------------------
// The pi-subagents prerequisite.
//
// Discovery follows that package's own guidance (its `docs/rpc.md`): the
// `subagents:ready` event is the announcement, but it fires on ITS first
// bound `session_start`, and two extensions' handlers have no guaranteed
// order — so a ping covers the case where it announced before cook was
// listening. A session that filtered pi-subagents out is indistinguishable
// from one where it is not installed, which is why the probe is bounded by
// a timeout and expiry is read as "not available here".
// ---------------------------------------------------------------------------

/** The package that supplies fresh-context subagent spawn on this host. */
const SUBAGENTS_PACKAGE = "@tintinweb/pi-subagents";

/** How long to wait for `subagents:ready` before falling back to a ping. */
const SUBAGENTS_READY_WAIT_MS = 3000;

/** How long a `subagents:rpc:ping` has to answer before it counts as absent. */
const SUBAGENTS_PING_WAIT_MS = 1000;

const MISSING_SUBAGENTS_NOTICE = [
	`cook: ${SUBAGENTS_PACKAGE} is not active in this session.`,
	"Attempts, verification and review all spawn subagents through its Agent",
	`tool, so /cook:drain, /cook:verify and /cook:review cannot run. Install it`,
	`with:  pi install ${SUBAGENTS_PACKAGE}`,
	"(/cook:status and /cook:register need no subagent and work regardless.)",
].join(" ");

function delay(ms: number): Promise<void> {
	return new Promise((done) => setTimeout(done, ms));
}

/**
 * True if pi-subagents answers `subagents:rpc:ping` within the window.
 *
 * The bus is in-process and untyped, so this reads the reply defensively:
 * anything but a success envelope, and any expiry, is "not available". The
 * requestId must be unique — it is interpolated straight into the reply
 * channel, so callers that omit it all share one.
 */
function pingSubagents(pi: ExtensionAPI): Promise<boolean> {
	const requestId = `cook-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return new Promise((answer) => {
		let settled = false;
		const settle = (available: boolean): void => {
			if (settled) return;
			settled = true;
			unsubscribe();
			answer(available);
		};
		const unsubscribe = pi.events.on(
			`subagents:rpc:ping:reply:${requestId}`,
			(reply: unknown) =>
				settle(
					typeof reply === "object" &&
						reply !== null &&
						(reply as { success?: unknown }).success === true,
				),
		);
		setTimeout(() => settle(false), SUBAGENTS_PING_WAIT_MS);
		pi.events.emit("subagents:rpc:ping", { requestId });
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

export default function cookExtension(pi: ExtensionAPI): void {
	// agent_settled drain-loop hardening state (see header, second slice).
	// `drainNudgeSent` mirrors the stop hook's `stop_hook_active` bound:
	// once a settle has injected the continue instruction, later settles
	// pass until genuine user input re-arms it — never inject twice in a
	// row. `gateDialogsPending` counts open cook_gate dialogs; the
	// hardening never fires while one is awaiting the human.
	let drainNudgeSent = false;
	let gateDialogsPending = 0;

	// Prerequisite-probe state (see header, third slice). Subscribing at
	// factory time, not in `session_start`, is what makes the announcement
	// catchable at all: pi-subagents may emit it from its own handler
	// before cook's runs.
	let subagentsSeen = false;
	let subagentsWarned = false;
	pi.events.on("subagents:ready", () => {
		subagentsSeen = true;
	});

	pi.on("session_start", (_event, ctx) => {
		if (subagentsWarned) return; // one warning per session, not per start
		// Detached, and it must be: pi AWAITS each session_start handler, so
		// waiting here would both delay the session and hold up
		// pi-subagents' own session_start — the handler that wires its RPC
		// and emits `subagents:ready`. A probe that waits inline is a probe
		// that blocks the answer it is waiting for, and reports "absent"
		// against a package that is loaded.
		void (async () => {
			// Give the announcement its window, then ping: whichever answers
			// first settles it. Both bounded — an unanswered probe means "not
			// available here", never a hang.
			await delay(SUBAGENTS_READY_WAIT_MS);
			if (subagentsSeen || (await pingSubagents(pi))) return;
			subagentsWarned = true;
			if (ctx.hasUI) ctx.ui.notify(MISSING_SUBAGENTS_NOTICE, "warning");
			else console.warn(MISSING_SUBAGENTS_NOTICE);
		})();
	});

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
			// must stay silent (see header, second slice).
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
