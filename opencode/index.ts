import { readdir, readFile } from "node:fs/promises"
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
  },
})
