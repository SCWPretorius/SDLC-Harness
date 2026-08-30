#!/usr/bin/env node
/**
 * Generate OpenCode agents from Copilot .github/agents/*.agent.md.
 *
 * Source of truth remains the Copilot files. Do not hand-edit
 * .opencode/agents/*.md — change the Copilot agent, then re-run:
 *
 *   node bin/sync-opencode-agents.mjs
 *
 * OpenCode models are omitted so the user's connected provider applies.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

const STANDARD_SPECIALISTS = [
  "analyst",
  "tech-pm",
  "ado-planner",
  "ado-ops",
  "implementer",
  "code-reviewer",
];

const ECONOMY_SPECIALISTS = STANDARD_SPECIALISTS.map((n) => `${n}-economy`);

const PRIMARY_AGENTS = new Set([
  "sdlc-orchestrator",
  "sdlc-orchestrator-economy",
]);

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    throw new Error("Missing YAML frontmatter");
  }
  const nl = raw.startsWith("---\r\n") ? "\r\n" : "\n";
  const close = raw.indexOf(`${nl}---`, 4);
  if (close === -1) {
    throw new Error("Unclosed YAML frontmatter");
  }
  const fm = raw.slice(4, close).replace(/\r\n/g, "\n");
  const body = raw.slice(close + nl.length + 3).replace(/^\r?\n/, "");
  return { fm, body };
}

function parseCopilotFrontmatter(fm) {
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name || !description) {
    throw new Error("Copilot agent frontmatter needs name and description");
  }

  const agents = [];
  const agentsBlock = fm.match(/^agents:\n((?:[ \t]*-[ \t].+\n?)+)/m);
  if (agentsBlock) {
    for (const line of agentsBlock[1].split("\n")) {
      const m = line.match(/^[ \t]*-[ \t]+(\S+)/);
      if (m) agents.push(m[1]);
    }
  }

  const handoffAgents = [];
  for (const m of fm.matchAll(/^[ \t]+agent:[ \t]+(\S+)/gm)) {
    if (!handoffAgents.includes(m[1])) handoffAgents.push(m[1]);
  }

  return { name, description, agents, handoffAgents };
}

function yamlKey(key) {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function dumpYamlMap(obj, indent) {
  const pad = " ".repeat(indent);
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    const k = yamlKey(key);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${pad}${k}:`);
      lines.push(dumpYamlMap(value, indent + 2));
    } else {
      lines.push(`${pad}${k}: ${value}`);
    }
  }
  return lines.join("\n");
}

function baseRole(name) {
  return name.replace(/-economy$/, "");
}

function specialistsFor(name, listed) {
  if (listed.length > 0) return listed;
  if (name === "sdlc-orchestrator") return STANDARD_SPECIALISTS;
  if (name === "sdlc-orchestrator-economy") return ECONOMY_SPECIALISTS;
  return [];
}

function taskAllowlist(names) {
  if (names.length === 0) return null;
  const task = { "*": "deny" };
  for (const n of names) task[n] = "allow";
  return task;
}

function permissionsFor(name, specialists, handoffAgents) {
  const role = baseRole(name);
  const task =
    role === "sdlc-orchestrator"
      ? taskAllowlist(specialists)
      : taskAllowlist(handoffAgents);

  /** @type {Record<string, unknown>} */
  let permission;
  switch (role) {
    case "sdlc-orchestrator":
      permission = { edit: "deny", bash: "deny" };
      break;
    case "analyst":
      permission = {
        edit: { "*": "deny", "docs/analysis/**": "allow" },
      };
      break;
    case "tech-pm":
      permission = { edit: "deny" };
      break;
    case "code-reviewer":
      permission = { edit: "deny", bash: "allow" };
      break;
    case "ado-planner":
    case "ado-ops":
      permission = { edit: "deny", bash: "allow" };
      break;
    case "implementer":
      permission = { edit: "allow", bash: "allow" };
      break;
    default:
      permission = {};
  }
  if (task) permission.task = task;
  return permission;
}

function rewriteBody(body) {
  let out = body;
  out = out.replace(/\[([^\]]+)\]\(\.\.\/skills\/[^)]+\)/g, "`$1`");
  out = out.replace(/`#tool:agent`/g, "the Task tool");
  out = out.replace(/#tool:agent/g, "the Task tool");
  out = out.replace(
    /Use the Task tool to invoke the listed subagents\. That is your primary action\./g,
    "Use the Task tool (or @mention) to invoke the listed subagents. That is your primary action.",
  );
  out = out.replace(
    /that agent with the Task tool and a complete brief/g,
    "that agent with the Task tool (or @mention) and a complete brief",
  );
  out = out.replace(
    /point them at the matching handoff button \(or invoke next subagent if they asked to continue\)/g,
    "wait for the user before invoking the next specialist (or invoke next if they asked to continue)",
  );
  out = out.replace(
    /Stay in `\*-economy` handoffs/g,
    "Stay on `*-economy` Task targets",
  );
  out = out.replace(/via (`[^`]+`) handoff/g, "via Task to $1");
  out = out.replace(/Offer handoff to/g, "Offer Task to");
  out = out.replace(/backlog handoff/g, "backlog Task");
  out = out.replace(/[Hh]and off to/g, "invoke via Task");
  out = out.replace(/Handoff to/g, "Invoke via Task / @mention");
  return out;
}

function invocationBlock(name) {
  if (PRIMARY_AGENTS.has(name)) {
    return `## OpenCode invocation

Primary agent. User Tab-cycles here. Invoke specialists with the **Task** tool or \`@name\`. Do **not** do specialist work yourself. After a specialist returns, **wait for the user** before the next specialist unless they asked to continue.

`;
  }
  return `## OpenCode invocation

Subagent. Invoked via Task or \`@\`. When this phase is done, stop and name the next specialist — do not start their work. Wait for the user (or parent) unless they asked to continue.

`;
}

function quoteYamlString(value) {
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.includes("'")) {
    return JSON.stringify(value);
  }
  return value;
}

function renderOpencodeAgent({ name, description, sourceFile, body, permission }) {
  const mode = PRIMARY_AGENTS.has(name) ? "primary" : "subagent";
  const permYaml = dumpYamlMap(permission, 2);
  const rewritten = rewriteBody(body).replace(/^\s+/, "");
  return `---
description: ${quoteYamlString(description)}
mode: ${mode}
permission:
${permYaml}
---

<!-- Generated from ${sourceFile} — run: node bin/sync-opencode-agents.mjs -->

${invocationBlock(name)}${rewritten.endsWith("\n") ? rewritten : `${rewritten}\n`}`;
}

export function syncOpencodeAgents(harnessRoot = PACKAGE_ROOT) {
  const srcDir = path.join(harnessRoot, ".github", "agents");
  const outDir = path.join(harnessRoot, ".opencode", "agents");
  if (!fs.existsSync(srcDir)) {
    throw new Error(`No Copilot agents at ${srcDir}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const existing = new Set(
    fs.existsSync(outDir)
      ? fs.readdirSync(outDir).filter((f) => f.endsWith(".md"))
      : [],
  );
  const written = [];

  for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith(".agent.md"))) {
    const raw = fs.readFileSync(path.join(srcDir, file), "utf8");
    const { fm, body } = parseFrontmatter(raw);
    const parsed = parseCopilotFrontmatter(fm);
    const specialists = specialistsFor(parsed.name, parsed.agents);
    const permission = permissionsFor(
      parsed.name,
      specialists,
      parsed.handoffAgents,
    );
    const outName = `${parsed.name}.md`;
    const contents = renderOpencodeAgent({
      name: parsed.name,
      description: parsed.description,
      sourceFile: `.github/agents/${file}`,
      body,
      permission,
    });
    fs.writeFileSync(path.join(outDir, outName), contents, "utf8");
    written.push(outName);
    existing.delete(outName);
  }

  for (const stale of existing) {
    fs.rmSync(path.join(outDir, stale), { force: true });
  }

  return { outDir, written, removed: [...existing] };
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isMain()) {
  const root = process.argv[2]
    ? path.resolve(process.argv[2])
    : PACKAGE_ROOT;
  const result = syncOpencodeAgents(root);
  console.log(
    `Wrote ${result.written.length} OpenCode agent(s) to ${result.outDir}`,
  );
  if (result.removed.length) {
    console.log(`Removed stale: ${result.removed.join(", ")}`);
  }
}
