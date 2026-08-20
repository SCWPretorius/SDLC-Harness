#!/usr/bin/env node
/**
 * npx sdlc-copilot-harness
 *
 * Interactive installer:
 * - asks for parent folder that holds sibling product repos
 * - copies/updates the SDLC Harness into that folder
 * - detects sibling directories and builds sdlc.code-workspace
 * - optionally links agents/skills into ~/.copilot
 * - optionally installs CodeGraph CLI, wires Copilot VS Code, inits each product repo
 *
 * Non-interactive:
 *   npx sdlc-copilot-harness --yes \
 *     --parent ~/dev \
 *     --agents-name "SDLC Harness" \
 *     --workspace sdlc.code-workspace \
 *     --folders "SDLC Harness,Contoso.Api,Fabrikam.Web" \
 *     --personal --personal-mode symlink \
 *     --codegraph
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import c from "picocolors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".vscode",
  ".idea",
  "dist",
  "build",
  "out",
  ".turbo",
  ".next",
]);

function parseArgs(argv) {
  const out = {
    yes: false,
    parent: null,
    agentsName: null,
    workspace: null,
    folders: null,
    personal: null,
    personalMode: null,
    codegraph: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "-h":
      case "--help":
        out.help = true;
        break;
      case "-y":
      case "--yes":
        out.yes = true;
        break;
      case "--parent":
        out.parent = next();
        break;
      case "--agents-name":
        out.agentsName = next();
        break;
      case "--workspace":
        out.workspace = next();
        break;
      case "--folders":
        out.folders = next()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--personal":
        out.personal = true;
        break;
      case "--no-personal":
        out.personal = false;
        break;
      case "--personal-mode":
        out.personalMode = next();
        break;
      case "--codegraph":
        out.codegraph = true;
        break;
      case "--no-codegraph":
        out.codegraph = false;
        break;
      default:
        if (a.startsWith("-")) {
          throw new Error(`Unknown flag: ${a}`);
        }
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage:
  npx sdlc-copilot-harness
  npx sdlc-copilot-harness --yes --parent <dir> [--folders A,B,C]

Options:
  --parent <dir>           Parent folder containing sibling repos
  --agents-name <name>     Harness folder name (default: SDLC Harness)
  --workspace <file>       Workspace filename (default: sdlc.code-workspace)
  --folders <a,b,c>        Folders to include (comma-separated)
  --personal / --no-personal
  --personal-mode symlink|copy
  --codegraph / --no-codegraph
                           Install CodeGraph CLI (if needed), wire Copilot VS Code,
                           and run codegraph init in each selected product repo
  -y, --yes                Non-interactive (requires --parent)
  -h, --help
`);
}

function commandExists(cmd) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [cmd], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function resolveCodegraphRunner() {
  if (commandExists("codegraph")) {
    return { cmd: "codegraph", prefix: [], label: "codegraph" };
  }
  if (commandExists("npx")) {
    return {
      cmd: "npx",
      prefix: ["--yes", "@colbymchenry/codegraph"],
      label: "npx @colbymchenry/codegraph",
    };
  }
  return null;
}

function ensureCodegraphCli() {
  let runner = resolveCodegraphRunner();
  if (runner?.cmd === "codegraph") {
    return { runner, installed: false };
  }

  if (!commandExists("npm")) {
    throw new Error(
      "CodeGraph CLI not found and npm is unavailable. Install Node/npm, then re-run with --codegraph, or: curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh",
    );
  }

  const install = spawnSync(
    "npm",
    ["install", "-g", "@colbymchenry/codegraph"],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (install.status !== 0) {
    throw new Error(
      "Failed to install @colbymchenry/codegraph globally. Try: npm i -g @colbymchenry/codegraph",
    );
  }

  runner = resolveCodegraphRunner();
  if (!runner) {
    throw new Error(
      "CodeGraph installed but not on PATH. Open a new terminal and re-run, or add npm global bin to PATH.",
    );
  }
  return { runner, installed: true };
}

function runCodegraph(runner, args, opts = {}) {
  const fullArgs = [...runner.prefix, ...args];
  const result = spawnSync(runner.cmd, fullArgs, {
    stdio: opts.stdio ?? "inherit",
    cwd: opts.cwd,
    shell: process.platform === "win32",
    env: process.env,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stderr: result.stderr?.toString?.() ?? "",
  };
}

function setupAndInitCodegraph({
  parentDir,
  agentsName,
  selectedFolders,
}) {
  const lines = [];
  const { runner, installed } = ensureCodegraphCli();
  lines.push(
    installed
      ? `CLI: installed @colbymchenry/codegraph (${runner.label})`
      : `CLI: using ${runner.label}`,
  );

  const wire = runCodegraph(runner, [
    "install",
    "--target=copilot-vscode",
    "--yes",
  ]);
  if (!wire.ok) {
    const fallback = runCodegraph(runner, ["install", "--target=auto", "--yes"]);
    if (!fallback.ok) {
      throw new Error(
        "codegraph install failed (tried --target=copilot-vscode and --target=auto)",
      );
    }
    lines.push("Wire: codegraph install --target=auto --yes");
  } else {
    lines.push("Wire: codegraph install --target=copilot-vscode --yes");
  }

  const productFolders = selectedFolders.filter((name) => name !== agentsName);
  if (productFolders.length === 0) {
    lines.push("Init: no product folders selected (harness skipped)");
    return { lines, inits: [] };
  }

  const inits = [];
  for (const name of productFolders) {
    const projectPath = path.join(parentDir, name);
    if (!isDirectory(projectPath)) {
      inits.push({ name, status: "missing" });
      lines.push(`Init: skip ${name} (folder missing)`);
      continue;
    }

    const already = fs.existsSync(path.join(projectPath, ".codegraph"));
    const init = runCodegraph(runner, ["init", projectPath], {
      // init can be long; inherit so user sees progress
      stdio: "inherit",
    });
    if (!init.ok) {
      inits.push({ name, status: "failed" });
      lines.push(`Init: FAILED ${name}`);
      continue;
    }
    inits.push({ name, status: already ? "rebuilt" : "ok" });
    lines.push(
      already ? `Init: ${name} (existing .codegraph refreshed)` : `Init: ${name}`,
    );
  }

  const failed = inits.filter((i) => i.status === "failed");
  if (failed.length > 0) {
    throw new Error(
      `CodeGraph init failed for: ${failed.map((f) => f.name).join(", ")}`,
    );
  }

  return { lines, inits };
}

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listSiblingFolders(parentDir) {
  return fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !name.startsWith(".") && !SKIP_DIR_NAMES.has(name))
    .sort((a, b) => a.localeCompare(b));
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function linkOrCopy(src, dest, mode) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (mode === "copy") {
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    if (isDirectory(src)) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
    return `copied ${dest}`;
  }
  try {
    if (fs.lstatSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  } catch {
    /* missing is fine */
  }
  fs.symlinkSync(src, dest, isDirectory(src) ? "dir" : "file");
  return `linked ${dest} → ${src}`;
}

function installPersonalCopilot(agentsRoot, mode) {
  const targetBase = path.join(os.homedir(), ".copilot");
  const agentsSrc = path.join(agentsRoot, ".github", "agents");
  const skillsSrc = path.join(agentsRoot, ".github", "skills");
  const lines = [];

  fs.mkdirSync(path.join(targetBase, "agents"), { recursive: true });
  fs.mkdirSync(path.join(targetBase, "skills"), { recursive: true });

  for (const f of fs.readdirSync(agentsSrc)) {
    if (!f.endsWith(".agent.md")) continue;
    lines.push(
      linkOrCopy(path.join(agentsSrc, f), path.join(targetBase, "agents", f), mode),
    );
  }

  for (const name of fs.readdirSync(skillsSrc)) {
    const src = path.join(skillsSrc, name);
    if (!isDirectory(src)) continue;
    lines.push(linkOrCopy(src, path.join(targetBase, "skills", name), mode));
  }

  return lines;
}

function buildWorkspace({ agentsFolderName, selectedFolders }) {
  const folders = [
    { name: agentsFolderName, path: `./${agentsFolderName}` },
    ...selectedFolders
      .filter((n) => n !== agentsFolderName)
      .map((n) => ({ name: n, path: `./${n}` })),
  ];

  return {
    folders,
    settings: {
      "chat.agentFilesLocations": [
        `\${workspaceFolder:${agentsFolderName}}/.github/agents`,
      ],
      "chat.useCustomizationsInParentRepositories": true,
    },
  };
}

function writeWorkspaceFile(parentDir, workspaceFileName, doc) {
  const outPath = path.join(parentDir, workspaceFileName);
  fs.writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  return outPath;
}

function ensureHarness(parentDir, agentsFolderName) {
  const dest = path.join(parentDir, agentsFolderName);
  const packageResolved = path.resolve(PACKAGE_ROOT);
  const destResolved = path.resolve(dest);

  if (destResolved === packageResolved) {
    return { dest, action: "current-package" };
  }

  const hasAgents = fs.existsSync(path.join(dest, ".github", "agents"));
  if (hasAgents) {
    return { dest, action: "existing" };
  }

  copyDir(PACKAGE_ROOT, dest);
  for (const junk of ["node_modules", "package-lock.json", ".git"]) {
    const j = path.join(dest, junk);
    if (fs.existsSync(j)) fs.rmSync(j, { recursive: true, force: true });
  }
  return { dest, action: "copied" };
}

function resolveUserPath(input) {
  let v = input.trim();
  if (v.startsWith("~/") || v === "~") {
    v = path.join(os.homedir(), v.slice(2));
  }
  return path.resolve(v);
}

function cancel() {
  p.cancel("Install cancelled.");
  process.exit(0);
}

function finish({
  parentDir,
  agentsRoot,
  action,
  workspacePath,
  workspaceDoc,
  personal,
  personalMode,
  personalLines,
  codegraph,
  codegraphLines,
}) {
  p.note(
    [
      `Parent:     ${parentDir}`,
      `Harness:    ${agentsRoot} (${action})`,
      `Workspace:  ${workspacePath}`,
      `Folders:    ${workspaceDoc.folders.map((f) => f.name).join(", ")}`,
      personal
        ? `~/.copilot: ${personalLines.length} links/copies (${personalMode})`
        : "~/.copilot: skipped",
      codegraph
        ? `CodeGraph:  set up (${(codegraphLines || []).filter((l) => l.startsWith("Init:")).length} repo inits)`
        : "CodeGraph:  skipped",
    ].join("\n"),
    "Result",
  );

  const next = [
    "1. VS Code → File → Open Workspace from File…",
    `   ${workspacePath}`,
    "2. az login && az extension add --name azure-devops --upgrade",
  ];
  if (codegraph) {
    next.push("3. Restart VS Code / Copilot (loads CodeGraph MCP)");
    next.push("4. Chat → sdlc-orchestrator (or sdlc-orchestrator-economy)");
  } else {
    next.push("3. codegraph install --target=copilot-vscode --yes");
    next.push("4. codegraph init in each product repo");
    next.push("5. Restart VS Code / Copilot");
    next.push("6. Chat → sdlc-orchestrator (or sdlc-orchestrator-economy)");
  }

  p.note(next.join("\n"), "Next");

  p.outro(c.green("Done. Open the workspace and start with sdlc-orchestrator."));
}

async function runInteractive(args) {
  console.log();
  p.intro(c.bgCyan(c.black(" sdlc-copilot-harness ")));

  const defaultParent = args.parent
    ? resolveUserPath(args.parent)
    : process.cwd();

  const parentDirRaw = await p.text({
    message: "Parent folder for sibling repos (workspace root)",
    placeholder: defaultParent,
    initialValue: defaultParent,
    validate(value) {
      const resolved = resolveUserPath(value?.trim() || defaultParent);
      if (!isDirectory(resolved)) return `Not a directory: ${resolved}`;
      return undefined;
    },
  });
  if (p.isCancel(parentDirRaw)) return cancel();
  const parentDir = resolveUserPath(parentDirRaw.trim() || defaultParent);

  const agentsFolderName = await p.text({
    message: "Harness folder name (will be created/updated here)",
    initialValue: args.agentsName || "SDLC Harness",
    validate(v) {
      if (!v?.trim()) return "Required";
      if (/[\\/]/.test(v)) return "Name only, not a path";
      return undefined;
    },
  });
  if (p.isCancel(agentsFolderName)) return cancel();
  const agentsName = agentsFolderName.trim();

  const siblings = listSiblingFolders(parentDir);
  const options = siblings.map((name) => ({
    value: name,
    label: name,
    hint: name === agentsName ? "harness" : undefined,
  }));

  if (!options.some((o) => o.value === agentsName)) {
    options.unshift({
      value: agentsName,
      label: `${agentsName} (will be created)`,
      hint: "harness",
    });
  }

  const selected = await p.multiselect({
    message: "Folders to include in the VS Code workspace",
    options:
      options.length > 0
        ? options
        : [{ value: agentsName, label: `${agentsName} (will be created)` }],
    initialValues: args.folders?.length
      ? args.folders
      : options.map((o) => o.value),
    required: true,
  });
  if (p.isCancel(selected)) return cancel();

  const selectedFolders = Array.from(
    new Set([agentsName, ...selected.map(String)]),
  );

  const workspaceFileName = await p.text({
    message: "Workspace file name (written into the parent folder)",
    initialValue: args.workspace || "sdlc.code-workspace",
    validate(v) {
      if (!v?.trim()) return "Required";
      if (!v.endsWith(".code-workspace")) {
        return "Must end with .code-workspace";
      }
      return undefined;
    },
  });
  if (p.isCancel(workspaceFileName)) return cancel();

  const personal = await p.confirm({
    message: "Also install agents/skills into ~/.copilot for personal use?",
    initialValue: args.personal ?? true,
  });
  if (p.isCancel(personal)) return cancel();

  let personalMode = args.personalMode || "symlink";
  if (personal) {
    const mode = await p.select({
      message: "~/.copilot install mode",
      options: [
        { value: "symlink", label: "Symlink (updates when harness changes)" },
        { value: "copy", label: "Copy (standalone snapshot)" },
      ],
      initialValue: personalMode,
    });
    if (p.isCancel(mode)) return cancel();
    personalMode = mode;
  }

  const productCount = selectedFolders.filter((n) => n !== agentsName).length;
  const codegraph = await p.confirm({
    message: `Set up CodeGraph? (CLI if needed, wire Copilot VS Code, init ${productCount} product repo${productCount === 1 ? "" : "s"})`,
    initialValue: args.codegraph ?? true,
  });
  if (p.isCancel(codegraph)) return cancel();

  return {
    parentDir,
    agentsName,
    selectedFolders,
    workspaceFileName: workspaceFileName.trim(),
    personal,
    personalMode,
    codegraph,
  };
}

function runNonInteractive(args) {
  if (!args.parent) {
    throw new Error("--yes requires --parent <dir>");
  }
  const parentDir = resolveUserPath(args.parent);
  if (!isDirectory(parentDir)) {
    throw new Error(`Not a directory: ${parentDir}`);
  }
  const agentsName = (args.agentsName || "SDLC Harness").trim();
  const siblings = listSiblingFolders(parentDir);
  const selectedFolders = Array.from(
    new Set([
      agentsName,
      ...(args.folders?.length ? args.folders : siblings),
    ]),
  );
  return {
    parentDir,
    agentsName,
    selectedFolders,
    workspaceFileName: args.workspace || "sdlc.code-workspace",
    personal: args.personal ?? true,
    personalMode: args.personalMode || "symlink",
    codegraph: args.codegraph ?? false,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const config = args.yes
    ? runNonInteractive(args)
    : await runInteractive(args);

  const s = p.spinner();
  s.start("Installing harness + workspace");

  const { dest: agentsRoot, action } = ensureHarness(
    config.parentDir,
    config.agentsName,
  );

  const workspaceDoc = buildWorkspace({
    agentsFolderName: config.agentsName,
    selectedFolders: config.selectedFolders,
  });
  const workspacePath = writeWorkspaceFile(
    config.parentDir,
    config.workspaceFileName,
    workspaceDoc,
  );

  let personalLines = [];
  if (config.personal) {
    personalLines = installPersonalCopilot(agentsRoot, config.personalMode);
  }

  s.stop("Install complete");

  let codegraphLines = [];
  if (config.codegraph) {
    p.log.step("Setting up CodeGraph (CLI, Copilot wire, init per product repo)…");
    const result = setupAndInitCodegraph({
      parentDir: config.parentDir,
      agentsName: config.agentsName,
      selectedFolders: config.selectedFolders,
    });
    codegraphLines = result.lines;
    p.note(codegraphLines.join("\n"), "CodeGraph");
  }

  finish({
    parentDir: config.parentDir,
    agentsRoot,
    action,
    workspacePath,
    workspaceDoc,
    personal: config.personal,
    personalMode: config.personalMode,
    personalLines,
    codegraph: config.codegraph,
    codegraphLines,
  });
}

main().catch((err) => {
  console.error(c.red(err.message || String(err)));
  process.exit(1);
});
