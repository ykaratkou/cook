import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Plugin, Skill } from "@opencode/plugin"

// The cook repo root is this adapter directory's parent, resolved at runtime so
// no machine-specific path is ever baked into a shipped file.
const adapterDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(adapterDir)
const dirs = {
  root,
  skills: path.join(root, "skills"),
  prompts: path.join(root, "prompts"),
  conventions: path.join(root, "conventions"),
  deliveryNote: path.join(root, "skills", "drain", "references", "host-opencode.md"),
  commands: path.join(adapterDir, "commands"),
}

// Cook's own skills start only from an explicit /cook:<verb> command (opencode
// ignores `disable-model-invocation`). The vendored companions keep the default.
const notAutoinvoked = new Set(["drain", "plan", "register"])

// The cook verbs this adapter registers; each has `commands/<verb>.md`.
// Drift note: each `commands/<verb>.md` mirrors the Claude Code command of the
// same verb (`claude-code/commands/<verb>.md`) — edit the two together.
const verbs = ["drain", "plan", "refine", "register", "status", "verify"]

type Markdown = { meta: Record<string, unknown>; body: string }

const parseMarkdown = (text: string): Markdown => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return { meta: {}, body: text }
  const meta: unknown = Bun.YAML.parse(match[1] ?? "")
  return {
    meta: typeof meta === "object" && meta !== null ? (meta as Record<string, unknown>) : {},
    body: text.slice(match[0].length),
  }
}

const field = (meta: Record<string, unknown>, key: string) => {
  const value = meta[key]
  return typeof value === "string" ? value : undefined
}

const loadSkills = async (): Promise<Skill.Info[]> => {
  const entries = await readdir(dirs.skills, { withFileTypes: true })
  const skills: Skill.Info[] = []
  for (const entry of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    const location = path.join(dirs.skills, entry.name, "SKILL.md")
    const text = await readFile(location, "utf8").catch(() => undefined)
    if (text === undefined) continue
    const { meta, body } = parseMarkdown(text)
    const description = field(meta, "description")
    skills.push({
      id: Skill.ID.make(`cook/${entry.name}`),
      name: Skill.Name.make(field(meta, "name") ?? entry.name),
      ...(description === undefined ? {} : { description }),
      ...(notAutoinvoked.has(entry.name) ? { autoinvoke: false } : {}),
      path: Skill.Info.fields.path.make(location),
      content: body,
    })
  }
  return skills
}

const resolve = (text: string, args: string) =>
  text.replaceAll("${COOK_ROOT}", dirs.root).replaceAll("$ARGUMENTS", args)

const trailer = (sessionID: string) =>
  [
    "",
    "---",
    "Runtime facts (supplied by the cook opencode plugin):",
    `- Cook root: ${dirs.root}`,
    `- Skills dir: ${dirs.skills}`,
    `- Prompts dir: ${dirs.prompts}`,
    `- Conventions dir: ${dirs.conventions}`,
    `- Delivery note (opencode): ${dirs.deliveryNote}`,
    `- Session id: ${sessionID}`,
    "",
  ].join("\n")

// Loop hardening: the opencode mirror of claude-code/hooks/stop-drain-guard.sh.
// opencode cannot veto a turn ending, so after a successful turn goes idle we
// queue one continue-the-drain prompt when the session's own fresh drain.lock
// says its drain is mid-flight. Optional (spec 10): correctness never depends
// on it, so every failure here is caught and logged, never thrown at a session.

const lockFreshMs = 10 * 60 * 1000 // the stop hook's `find -mmin -10`

const log = (error: unknown) =>
  console.error("[cook] drain loop hardening:", error instanceof Error ? error.message : error)

// The first fresh `.cook/tasks/*/drain.lock` whose `session` is this session's
// id, or undefined. Anything unreadable stays silent, as in the stop hook.
const ownFreshLock = async (directory: string, sessionID: string) => {
  const tasks = path.join(directory, ".cook", "tasks")
  const sets = await readdir(tasks, { withFileTypes: true }).catch(() => [])
  for (const set of sets) {
    if (!set.isDirectory()) continue
    const lock = path.join(tasks, set.name, "drain.lock")
    const info = await stat(lock).catch(() => undefined)
    if (info === undefined || Date.now() - info.mtimeMs >= lockFreshMs) continue
    const parsed: unknown = await readFile(lock, "utf8")
      .then((text) => JSON.parse(text))
      .catch(() => undefined)
    const session = typeof parsed === "object" && parsed !== null ? (parsed as { session?: unknown }).session : undefined
    if (typeof session === "string" && session !== "" && session === sessionID) return { lock, set: set.name }
  }
  return undefined
}

// The stop hook's message, verbatim in meaning.
const continueDrain = (lock: string, set: string) =>
  [
    `A fresh drain lock exists at ${lock} (set: ${set}), and its session`,
    "id is yours, so your cook drain appears to be mid-flight. Continue the",
    "drain loop — re-derive the set's status from its files and run the next",
    "iteration; do not end your turn while the set derives READY and no gate is",
    "open. If the drain has in fact reached an exit path, remove the stale lock",
    "and report the disposition.",
  ].join("\n")

const hardeningMarker = "cook.drain-hardening"

// opencode 2.0.20 sets the plugin up once per location (working directory), and
// every instance's event stream carries every session's events. Each instance
// acting on every session is what injected once per instance, again and again.
// So only the instance whose location is the session's acts, and the once-only
// guard is read from the session's history rather than kept in memory: an
// instance set up later (an evicted location re-created, a plugin reload)
// holds no state, but the history still says who prompted last. (Evicting a
// location also cancels its open forms, so a fresh instance's empty form map
// stays true.)
const hardenDrainLoop = async (ctx: Plugin.Context) => {
  const here = ctx.location.directory
  // Open `question` forms per session: a gate is waiting for the human.
  const questions = new Map<string, Set<string>>()
  const questionOpen = (sessionID: string) => (questions.get(sessionID)?.size ?? 0) > 0

  // The stop hook's `stop_hook_active` guard: stay silent while the session's
  // latest user message is our own injection. Only a human-typed prompt (a user
  // message without our marker) re-arms it; with no user message in view there
  // is no human prompt to answer, so stay silent too.
  const lastPromptIsOurs = async (sessionID: string) => {
    const messages = await ctx.session.context({ sessionID })
    const last = messages.findLast((message) => message.type === "user")
    return last?.type !== "user" || last.metadata?.[hardeningMarker] === true
  }

  // Sessions with a check in flight, so one turn's end never injects twice.
  const checking = new Set<string>()

  const onIdle = async (sessionID: string) => {
    if (checking.has(sessionID)) return
    checking.add(sessionID)
    try {
      await checkAndInject(sessionID)
    } finally {
      checking.delete(sessionID)
    }
  }

  const checkAndInject = async (sessionID: string) => {
    if (questionOpen(sessionID)) return
    const session = await ctx.session.get({ sessionID })
    if (session.location.directory !== here) return
    const own = await ownFreshLock(session.location.directory, sessionID)
    if (own === undefined || (await lastPromptIsOurs(sessionID)) || questionOpen(sessionID)) return
    await ctx.session.prompt({
      sessionID,
      text: continueDrain(own.lock, own.set),
      delivery: "queue",
      metadata: { [hardeningMarker]: true },
    })
  }

  const abort = new AbortController()
  void (async () => {
    for await (const event of ctx.event.subscribe({ signal: abort.signal })) {
      try {
        // A successful execution is the turn ending and the session going idle.
        // (2.0.20 does not deliver `session.idle` to plugin subscribers.)
        if (event.type === "session.execution.succeeded") {
          onIdle(event.data.sessionID).catch(log)
        } else if (event.type === "form.created") {
          const { form } = event.data
          if (form.metadata?.["kind"] !== "question") continue
          const open = questions.get(form.sessionID) ?? new Set<string>()
          questions.set(form.sessionID, open.add(form.id))
        } else if (event.type === "form.replied" || event.type === "form.cancelled") {
          questions.get(event.data.sessionID)?.delete(event.data.id)
        }
      } catch (error) {
        log(error)
      }
    }
  })().catch((error: unknown) => {
    if (!abort.signal.aborted) log(error)
  })
  return () => abort.abort()
}

export default Plugin.define({
  id: "cook",
  async setup(ctx) {
    const skills = await loadSkills()
    await ctx.skill.transform((editor) => {
      for (const skill of skills) editor.add(skill)
    })
    await ctx.skill.reload()

    const commands = await Promise.all(
      verbs.map(async (verb) => ({
        verb,
        ...parseMarkdown(await readFile(path.join(dirs.commands, `${verb}.md`), "utf8")),
      })),
    )
    await ctx.command.transform((editor) => {
      for (const { verb, meta, body } of commands) {
        const description = field(meta, "description")
        editor.add({
          name: `cook:${verb}`,
          ...(description === undefined ? {} : { description }),
          execute: async ({ sessionID, prompt, delivery }) => {
            await ctx.session.prompt({
              sessionID,
              text: resolve(body, prompt.text.trim()) + trailer(sessionID),
              delivery,
            })
          },
        })
      }
    })
    await ctx.command.reload()

    const stopHardening = await hardenDrainLoop(ctx).catch((error: unknown) => log(error))
    return () => stopHardening?.()
  },
})
