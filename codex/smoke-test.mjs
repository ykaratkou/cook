// Isolated install + real host skill discovery. No credentials or model calls.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const home = await realpath(await mkdtemp(path.join(tmpdir(), "cook-codex-smoke-")));
const env = { ...process.env, CODEX_HOME: home };
const bin = process.env.CODEX_BIN || "codex";
const verbs = ["auto-grill", "drain", "map", "plan", "refine", "register", "status", "verify"];
let server;
try {
  for (const args of [
    ["plugin", "marketplace", "add", root],
    ["plugin", "add", "cook@cook", "--json"],
  ]) {
    const result = spawnSync(bin, args, { env, encoding: "utf8", timeout: 60_000 });
    assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  }

  server = spawn(bin, ["app-server"], { env, stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  let id = 0;
  let stderr = "";
  server.stderr.on("data", (data) => { stderr += data; });
  const lines = createInterface({ input: server.stdout });
  lines.on("line", (line) => {
    const message = JSON.parse(line);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  server.on("error", fail);
  server.on("exit", () => fail(new Error(`App server exited: ${stderr}`)));
  function fail(error) {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  }
  function rpc(method, params) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Timed out: ${method}\n${stderr}`));
      }, 30_000);
      pending.set(requestId, { resolve, reject, timer });
      server.stdin.write(JSON.stringify({ id: requestId, method, params }) + "\n");
    });
  }
  await rpc("initialize", {
    clientInfo: { name: "cook-smoke", version: "1" },
    capabilities: { experimentalApi: true },
  });
  server.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
  const result = await rpc("skills/list", { cwds: [home], forceReload: true });
  const skills = result.data.flatMap((entry) => entry.skills);
  for (const verb of verbs) {
    const skill = skills.find((entry) => entry.name === `cook:${verb}` && entry.pluginId === "cook@cook");
    assert.ok(skill, `Missing cook:${verb}; found: ${skills.map((entry) => entry.name).join(", ")}`);
    assert.equal(skill.enabled, true);
    const installed = await realpath(skill.path);
    assert.ok(installed.startsWith(home + path.sep), `Not a cached install: ${installed}`);
    const text = await readFile(installed, "utf8");
    assert.match(await readFile(path.join(path.dirname(installed), "agents/openai.yaml"), "utf8"), /allow_implicit_invocation: false/);
    for (const [, reference] of text.matchAll(/`(\.\.\/[^`]+\.md)`/g)) {
      await readFile(path.resolve(path.dirname(installed), reference), "utf8");
    }
    const installedRoot = path.resolve(path.dirname(installed), "../../..");
    for (const companion of ["grilling", "to-spec", "to-tickets", "domain-modeling", "wayfinder", "research", "prototype", "grill-with-docs"]) {
      assert.equal(
        await readFile(path.join(installedRoot, "skills", companion, "SKILL.md"), "utf8"),
        await readFile(path.join(root, "skills", companion, "SKILL.md"), "utf8"),
      );
    }
    if (verb === "plan" || verb === "map") {
      assert.match(await readFile(path.join(installedRoot, "skills", verb, "SKILL.md"), "utf8"), /^## Stops$/m);
    }
    await readFile(path.join(installedRoot, "prompts", "implementer.md"), "utf8");
    await readFile(path.join(installedRoot, "conventions", "verification.md"), "utf8");
  }
  console.log("SMOKE OK: cached plugin install, eight explicit-only skills, shared references, companions and Stops");
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  await rm(home, { recursive: true, force: true });
}
