import assert from "node:assert/strict"
import test from "node:test"
import { fileURLToPath } from "node:url"
import plugin from "./index.ts"

const setup = async () => {
  const commands = new Map()
  const calls = []
  const entries = new Map()
  const ctx = {
    skill: { transform: async () => {}, reload: async () => {} },
    command: {
      transform: async (transform) => transform({ add: (command) => commands.set(command.name, command) }),
      reload: async () => {},
    },
    session: {
      instructions: { entry: { put: async (input) => {
        calls.push({ type: "instructions", ...input })
        entries.set(input.sessionID, input)
      } } },
      prompt: async (input) => { calls.push({ type: "prompt", ...input }) },
    },
  }
  // Node runs these adapter tests without Bun; frontmatter metadata is not
  // under test. The command bodies and runtime paths still use real files.
  const previous = globalThis.Bun
  globalThis.Bun = { YAML: { parse: () => ({}) } }
  try {
    await plugin.setup(ctx)
  } finally {
    if (previous === undefined) delete globalThis.Bun
    else globalThis.Bun = previous
  }
  return { commands, calls, entries, ctx }
}

test("expanded instructions precede a compact command prompt", async () => {
  const { commands, calls } = await setup()
  assert.equal(commands.size, 7)
  await commands.get("cook:drain").execute({
    sessionID: "session-a", prompt: { text: "  kanban-board-layout  " }, delivery: "queue",
  })
  assert.equal(calls[0].type, "instructions")
  assert.equal(calls[0].key, "cook/active-command")
  assert.equal(calls[0].sessionID, "session-a")
  assert.ok(calls[0].value.includes("Set argument: kanban-board-layout"))
  assert.ok(calls[0].value.includes(fileURLToPath(new URL("../skills/drain/SKILL.md", import.meta.url))))
  assert.ok(calls[0].value.includes("Runtime facts (supplied by the cook opencode plugin):"))
  assert.ok(!calls[0].value.includes("${COOK_ROOT}"))
  assert.deepEqual(calls[1], {
    type: "prompt", sessionID: "session-a", text: "/cook:drain kanban-board-layout", delivery: "queue",
  })
})

test("empty arguments do not add a trailing space", async () => {
  const { commands, calls } = await setup()
  await commands.get("cook:status").execute({
    sessionID: "session-a", prompt: { text: "   " }, delivery: "steer",
  })
  assert.equal(calls[1].text, "/cook:status")
  assert.equal(calls[1].delivery, "steer")
})

test("attachments survive while stale composer offsets are removed", async () => {
  const { commands, calls } = await setup()
  const mention = { start: 0, end: 3, text: "old" }
  const prompt = {
    text: "target",
    files: [
      { uri: "file:///tmp/example", name: "example", description: "reference", source: { type: "uri", uri: "file:///tmp/example" }, mention },
      { uri: "file:///tmp/other", name: undefined },
    ],
    agents: [{ name: "general", mention }],
    skills: [{ id: "cook/research", mention }],
  }
  await commands.get("cook:plan").execute({ sessionID: "session-a", prompt, delivery: "steer" })
  assert.deepEqual(calls[1].files, [
    { uri: "file:///tmp/example", name: "example", description: "reference", source: { type: "uri", uri: "file:///tmp/example" } },
    { uri: "file:///tmp/other" },
  ])
  assert.deepEqual(calls[1].agents, [{ name: "general" }])
  assert.deepEqual(calls[1].skills, [{ id: "cook/research" }])
  assert.equal(prompt.files[0].mention, mention)
})

test("later Cook commands replace context only in their own session", async () => {
  const { commands, entries } = await setup()
  const run = (verb, sessionID, text) => commands.get(`cook:${verb}`).execute({
    sessionID, prompt: { text }, delivery: "steer",
  })
  await run("drain", "session-a", "first")
  await run("drain", "session-b", "other")
  const other = entries.get("session-b")
  await run("plan", "session-a", "replacement")
  assert.equal(entries.size, 2)
  assert.ok(entries.get("session-a").value.includes("replacement"))
  assert.equal(entries.get("session-b"), other)
})

test("instruction failure does not submit an uninstructed prompt", async () => {
  const { commands, calls, ctx } = await setup()
  ctx.session.instructions.entry.put = async () => { throw new Error("write failed") }
  await assert.rejects(commands.get("cook:drain").execute({
    sessionID: "session-a", prompt: { text: "target" }, delivery: "steer",
  }), /write failed/)
  assert.equal(calls.length, 0)
})
