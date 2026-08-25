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
 * Uninstall (reverses the above):
 *   npx sdlc-copilot-harness uninstall
 *   npx sdlc-copilot-harness uninstall --yes --parent ~/dev
 *
 * Non-interactive install:
 *   npx sdlc-copilot-harness --yes \
 *     --parent ~/dev \
 *     --agents-name "SDLC Harness" \
 *     --workspace sdlc.code-workspace \
 *     --folders "SDLC Harness,Contoso.Api,Fabrikam.Web" \
 *     --personal --personal-mode symlink \
 *     --codegraph \
 *     --caveman
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

const STATE_FILENAME = ".sdlc-copilot-harness.json";
const LAST_INSTALL_DIR = path.join(os.homedir(), ".sdlc-copilot-harness");
const LAST_INSTALL_FILE = path.join(LAST_INSTALL_DIR, "last-install.json");

/** Optional pack from JuliusBrussee/caveman (excludes Cloud-only + core `caveman`). */
const CAVEMAN_PACK_SKILLS = [
  "cavecrew",
  "caveman-commit",
  "caveman-compress",
  "caveman-explore",
  "caveman-help",
  "caveman-review",
  "caveman-stats",
  "investigate-first",
  "lean-build",
  "migration",
  "safe-refactor",
  "surgical-patch",
  "verify-and-stop",
];

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
    caveman: null,
    help: false,
    uninstall: false,
    keepPersonal: false,
    keepWorkspace: false,
    keepHarness: false,
    keepCodegraph: false,
    keepCaveman: false,
    removeCodegraphCli: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (i === 0 && (a === "uninstall" || a === "install")) {
      if (a === "uninstall") out.uninstall = true;
      continue;
    }
    switch (a) {
      case "-h":
      case "--help":
        out.help = true;
        break;
      case "-y":
      case "--yes":
        out.yes = true;
        break;
      case "--uninstall":
        out.uninstall = true;
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
      case "--caveman":
        out.caveman = true;
        break;
      case "--no-caveman":
        out.caveman = false;
        break;
      case "--keep-personal":
        out.keepPersonal = true;
        break;
      case "--keep-workspace":
        out.keepWorkspace = true;
        break;
      case "--keep-harness":
        out.keepHarness = true;
        break;
      case "--keep-codegraph":
        out.keepCodegraph = true;
        break;
      case "--keep-caveman":
        out.keepCaveman = true;
        break;
      case "--remove-codegraph-cli":
        out.removeCodegraphCli = true;
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
  npx sdlc-copilot-harness uninstall
  npx sdlc-copilot-harness uninstall --yes --parent <dir>

Install options:
  --parent <dir>           Parent folder containing sibling repos
  --agents-name <name>     Harness folder name (default: SDLC Harness)
  --workspace <file>       Workspace filename (default: sdlc.code-workspace)
  --folders <a,b,c>        Folders to include (comma-separated)
  --personal / --no-personal
  --personal-mode symlink|copy
  --codegraph / --no-codegraph
                           Install CodeGraph CLI (if needed), wire Copilot VS Code,
                           and run codegraph init in each selected product repo
  --caveman / --no-caveman
                           Vendor optional JuliusBrussee/caveman skill pack into the
                           harness .github/skills (does not replace core caveman)
  -y, --yes                Non-interactive (install requires --parent)
  -h, --help

Uninstall options:
  uninstall, --uninstall   Remove what this installer created
  --parent <dir>           Parent folder used at install (or last-install is used)
  --keep-personal          Leave ~/.copilot agents/skills in place
  --keep-workspace         Leave the .code-workspace file
  --keep-harness           Leave the harness folder
  --keep-codegraph         Leave CodeGraph indexes and Copilot wire
  --keep-caveman           Leave optional caveman pack skills in the harness
  --remove-codegraph-cli   Also uninstall the CodeGraph CLI (only if this installer added it)
  -y, --yes                Non-interactive uninstall
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

  let wireTarget = "copilot-vscode";
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
    wireTarget = "auto";
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

  return {
    lines,
    inits,
    cliInstalledByUs: installed,
    wireTarget,
  };
}

function copySkillTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "agents" ||
      entry.name === "tests"
    ) {
      continue;
    }
    if (entry.name === "package.json" && !entry.isDirectory()) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copySkillTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

/**
 * Sparse-clone JuliusBrussee/caveman and copy optional skills into the harness.
 * Never overwrites the harness-customized `caveman` skill.
 * Call before personal ~/.copilot install so symlinks pick up the pack.
 */
function setupCavemanSkills({ agentsRoot }) {
  if (!commandExists("git")) {
    throw new Error(
      "git is required to install the caveman skill pack. Install git, or skip with --no-caveman.",
    );
  }

  const lines = [];
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sdlc-caveman-"));
  const cloneDir = path.join(tmpRoot, "caveman");
  const skillsDest = path.join(agentsRoot, ".github", "skills");
  fs.mkdirSync(skillsDest, { recursive: true });

  try {
    const clone = spawnSync(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "--filter=blob:none",
        "--sparse",
        "https://github.com/JuliusBrussee/caveman.git",
        cloneDir,
      ],
      { stdio: "pipe", shell: process.platform === "win32" },
    );
    if (clone.status !== 0) {
      throw new Error(
        `Failed to clone JuliusBrussee/caveman: ${clone.stderr?.toString?.() || "unknown error"}`,
      );
    }

    const sparse = spawnSync(
      "git",
      ["sparse-checkout", "set", "skills"],
      { cwd: cloneDir, stdio: "pipe", shell: process.platform === "win32" },
    );
    if (sparse.status !== 0) {
      throw new Error(
        `Failed to sparse-checkout caveman skills: ${sparse.stderr?.toString?.() || "unknown error"}`,
      );
    }

    const installed = [];
    const harnessPaths = [];

    for (const name of CAVEMAN_PACK_SKILLS) {
      if (name === "caveman") continue;
      const src = path.join(cloneDir, "skills", name);
      if (!fs.existsSync(path.join(src, "SKILL.md"))) {
        lines.push(`Skip: ${name} (no SKILL.md upstream)`);
        continue;
      }
      const dest = path.join(skillsDest, name);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      copySkillTree(src, dest);
      fs.writeFileSync(
        path.join(dest, "ATTRIBUTION.md"),
        `Source: https://github.com/JuliusBrussee/caveman (skills/${name})\nInstalled by sdlc-copilot-harness --caveman.\n`,
        "utf8",
      );
      installed.push(name);
      harnessPaths.push(dest);
      lines.push(`Skill: ${name}`);
    }

    lines.unshift(
      `Pack: JuliusBrussee/caveman → ${installed.length} skill${installed.length === 1 ? "" : "s"} (core caveman left as-is)`,
    );

    return {
      lines,
      skillNames: installed,
      harnessPaths,
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function uninstallCavemanSkills(state) {
  const lines = [];
  const names = state.cavemanSkillNames || [];
  const agentsRoot = state.agentsRoot;

  for (const name of names) {
    if (agentsRoot) {
      const dest = path.join(agentsRoot, ".github", "skills", name);
      if (removePath(dest)) lines.push(`removed harness skill ${name}`);
    }
    const personalDest = path.join(os.homedir(), ".copilot", "skills", name);
    if (removePath(personalDest)) lines.push(`removed ~/.copilot/skills/${name}`);
  }

  if (lines.length === 0) lines.push("no caveman pack skills found");
  return lines;
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
    if (entry.name === STATE_FILENAME) continue;
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
  const paths = [];

  fs.mkdirSync(path.join(targetBase, "agents"), { recursive: true });
  fs.mkdirSync(path.join(targetBase, "skills"), { recursive: true });

  for (const f of fs.readdirSync(agentsSrc)) {
    if (!f.endsWith(".agent.md")) continue;
    const dest = path.join(targetBase, "agents", f);
    lines.push(linkOrCopy(path.join(agentsSrc, f), dest, mode));
    paths.push(dest);
  }

  for (const name of fs.readdirSync(skillsSrc)) {
    const src = path.join(skillsSrc, name);
    if (!isDirectory(src)) continue;
    const dest = path.join(targetBase, "skills", name);
    lines.push(linkOrCopy(src, dest, mode));
    paths.push(dest);
  }

  return { lines, paths };
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

function cancel(message = "Install cancelled.") {
  p.cancel(message);
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
  caveman,
  cavemanLines,
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
      caveman
        ? `Caveman:    pack installed (${(cavemanLines || []).filter((l) => l.startsWith("Skill:")).length} skills)`
        : "Caveman:    pack skipped (core chat skill still in harness)",
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
  next.push("To remove later: npx sdlc-copilot-harness uninstall");

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

  const caveman = await p.confirm({
    message:
      "Install optional caveman skill pack? (commit/review/explore/workflow skills from JuliusBrussee/caveman — core caveman chat stays as-is)",
    initialValue: args.caveman ?? true,
  });
  if (p.isCancel(caveman)) return cancel();

  return {
    parentDir,
    agentsName,
    selectedFolders,
    workspaceFileName: workspaceFileName.trim(),
    personal,
    personalMode,
    codegraph,
    caveman,
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
    caveman: args.caveman ?? false,
  };
}

function pathExists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function looksLikeHarness(dir) {
  return fs.existsSync(
    path.join(dir, ".github", "agents", "sdlc-orchestrator.agent.md"),
  );
}

function inferHarnessAction(agentsRoot) {
  if (path.resolve(agentsRoot) === path.resolve(PACKAGE_ROOT)) {
    return "current-package";
  }
  if (!looksLikeHarness(agentsRoot)) return null;
  const pkg = readJsonFile(path.join(agentsRoot, "package.json"));
  const copiedPackage =
    pkg?.name === "sdlc-copilot-harness" &&
    !pathExists(path.join(agentsRoot, ".git"));
  return copiedPackage ? "copied" : "existing";
}

function writeInstallState(state) {
  const parentState = path.join(state.parentDir, STATE_FILENAME);
  const body = `${JSON.stringify(state, null, 2)}\n`;
  fs.writeFileSync(parentState, body, "utf8");
  fs.mkdirSync(LAST_INSTALL_DIR, { recursive: true });
  fs.writeFileSync(LAST_INSTALL_FILE, body, "utf8");
  return parentState;
}

function loadInstallState(parentDir) {
  if (parentDir) {
    const fromParent = readJsonFile(path.join(parentDir, STATE_FILENAME));
    if (fromParent) return fromParent;
  }
  return readJsonFile(LAST_INSTALL_FILE);
}

function listHarnessAgentFiles(agentsRoot) {
  const dir = path.join(agentsRoot, ".github", "agents");
  const src = isDirectory(dir)
    ? dir
    : path.join(PACKAGE_ROOT, ".github", "agents");
  if (!isDirectory(src)) return [];
  return fs.readdirSync(src).filter((f) => f.endsWith(".agent.md"));
}

function listHarnessSkillNames(agentsRoot) {
  const dir = path.join(agentsRoot, ".github", "skills");
  const src = isDirectory(dir)
    ? dir
    : path.join(PACKAGE_ROOT, ".github", "skills");
  if (!isDirectory(src)) return [];
  return fs
    .readdirSync(src, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function discoverPersonalPaths(agentsRoot) {
  const targetBase = path.join(os.homedir(), ".copilot");
  const agentsRootResolved = path.resolve(agentsRoot);
  const found = [];

  for (const f of listHarnessAgentFiles(agentsRoot)) {
    const dest = path.join(targetBase, "agents", f);
    if (shouldRemovePersonalPath(dest, agentsRootResolved)) found.push(dest);
  }
  for (const name of listHarnessSkillNames(agentsRoot)) {
    const dest = path.join(targetBase, "skills", name);
    if (shouldRemovePersonalPath(dest, agentsRootResolved)) found.push(dest);
  }
  return found;
}

function shouldRemovePersonalPath(dest, agentsRootResolved) {
  try {
    const st = fs.lstatSync(dest);
    if (!st.isSymbolicLink()) return false;
    let target = fs.readlinkSync(dest);
    if (!path.isAbsolute(target)) {
      target = path.resolve(path.dirname(dest), target);
    }
    const rel = path.relative(agentsRootResolved, target);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  } catch {
    return false;
  }
}

function discoverInstall(parentDir) {
  const fromParent = readJsonFile(path.join(parentDir, STATE_FILENAME));
  if (fromParent) return fromParent;
  const last = readJsonFile(LAST_INSTALL_FILE);
  if (last?.parentDir && path.resolve(last.parentDir) === path.resolve(parentDir)) {
    return last;
  }

  const workspaceCandidates = fs
    .readdirSync(parentDir)
    .filter((n) => n.endsWith(".code-workspace"));
  const workspaceFile =
    workspaceCandidates.find((n) => n === "sdlc.code-workspace") ??
    workspaceCandidates[0] ??
    null;

  let agentsName = "SDLC Harness";
  let selectedFolders = [];
  if (workspaceFile) {
    const doc = readJsonFile(path.join(parentDir, workspaceFile));
    if (doc?.folders?.length) {
      selectedFolders = doc.folders.map((f) => f.name);
      const loc = doc.settings?.["chat.agentFilesLocations"]?.[0];
      const m =
        typeof loc === "string"
          ? loc.match(/workspaceFolder:([^}]+)/)
          : null;
      if (m?.[1]) agentsName = m[1];
      else if (doc.folders[0]?.name) agentsName = doc.folders[0].name;
    }
  } else {
    for (const name of listSiblingFolders(parentDir)) {
      if (looksLikeHarness(path.join(parentDir, name))) {
        agentsName = name;
        break;
      }
    }
    selectedFolders = listSiblingFolders(parentDir);
  }

  const agentsRoot = path.join(parentDir, agentsName);
  const personalPaths = discoverPersonalPaths(agentsRoot);
  const codegraphInits = (selectedFolders.length
    ? selectedFolders
    : listSiblingFolders(parentDir)
  )
    .filter((n) => n !== agentsName)
    .filter((n) => fs.existsSync(path.join(parentDir, n, ".codegraph")))
    .map((n) => ({
      name: n,
      status: "ok",
      path: path.join(parentDir, n),
    }));

  const harnessAction = inferHarnessAction(agentsRoot);

  return {
    version: 1,
    discovered: true,
    parentDir,
    agentsName,
    agentsRoot,
    harnessAction,
    workspacePath: workspaceFile
      ? path.join(parentDir, workspaceFile)
      : null,
    selectedFolders,
    personal: personalPaths.length > 0,
    personalPaths,
    codegraph: codegraphInits.length > 0,
    codegraphCliInstalledByUs: false,
    codegraphWire: codegraphInits.length > 0 ? "copilot-vscode" : null,
    codegraphInits,
  };
}

function removePath(target) {
  if (!pathExists(target)) return false;
  fs.rmSync(target, { recursive: true, force: true });
  return true;
}

function uninstallPersonal(paths) {
  const removed = [];
  for (const dest of paths) {
    if (removePath(dest)) removed.push(dest);
  }
  return removed;
}

function uninstallCodegraphIndexes(inits) {
  const lines = [];
  const runner = resolveCodegraphRunner();
  for (const item of inits) {
    const projectPath = item.path || item.name;
    if (!isDirectory(projectPath)) {
      lines.push(`skip ${item.name} (folder missing)`);
      continue;
    }
    const graphDir = path.join(projectPath, ".codegraph");
    if (!pathExists(graphDir)) {
      lines.push(`skip ${item.name} (no .codegraph)`);
      continue;
    }
    if (runner) {
      const result = runCodegraph(
        runner,
        ["uninit", projectPath, "--force"],
        { stdio: "pipe" },
      );
      if (result.ok) {
        lines.push(`uninit ${item.name}`);
        continue;
      }
    }
    removePath(graphDir);
    lines.push(`removed ${item.name}/.codegraph`);
  }
  return lines;
}

function uninstallCodegraphWire(wireTarget) {
  const runner = resolveCodegraphRunner();
  if (!runner) {
    return "CodeGraph CLI not on PATH; skipped Copilot unwire";
  }
  const target = wireTarget === "auto" ? "copilot-vscode" : (wireTarget || "copilot-vscode");
  const result = runCodegraph(runner, [
    "uninstall",
    `--target=${target}`,
    "--yes",
    "--keep-cli",
  ]);
  if (!result.ok) {
    return `codegraph uninstall --target=${target} failed (CLI left in place)`;
  }
  return `unwired CodeGraph from ${target}`;
}

function uninstallCodegraphCli() {
  const lines = [];
  if (commandExists("npm")) {
    const result = spawnSync(
      "npm",
      ["uninstall", "-g", "@colbymchenry/codegraph"],
      { stdio: "inherit", shell: process.platform === "win32" },
    );
    if (result.status === 0) {
      lines.push("uninstalled npm global @colbymchenry/codegraph");
    } else {
      lines.push("npm uninstall -g @colbymchenry/codegraph failed");
    }
  } else {
    lines.push("npm not available; skipped CLI uninstall");
  }
  return lines;
}

function clearInstallState(parentDir) {
  removePath(path.join(parentDir, STATE_FILENAME));
  const last = readJsonFile(LAST_INSTALL_FILE);
  if (last && path.resolve(last.parentDir) === path.resolve(parentDir)) {
    removePath(LAST_INSTALL_FILE);
  }
}

function defaultUninstallTargets(state, args) {
  const selected = [];
  if (state.personalPaths?.length && !args.keepPersonal) selected.push("personal");
  if (state.workspacePath && !args.keepWorkspace) selected.push("workspace");
  if (
    !args.keepHarness &&
    state.harnessAction === "copied" &&
    path.resolve(state.agentsRoot) !== path.resolve(PACKAGE_ROOT)
  ) {
    selected.push("harness");
  }
  if (!args.keepCodegraph) {
    if (state.codegraphInits?.length) selected.push("codegraph-indexes");
    if (state.codegraph || state.codegraphWire) selected.push("codegraph-wire");
  }
  if (
    !args.keepCaveman &&
    (state.cavemanSkillNames?.length || state.caveman)
  ) {
    selected.push("caveman-pack");
  }
  if (args.removeCodegraphCli && state.codegraphCliInstalledByUs) {
    selected.push("codegraph-cli");
  }
  return selected;
}

function buildUninstallOptions(state) {
  const options = [];
  const personalCount = state.personalPaths?.length ?? 0;
  if (personalCount > 0) {
    options.push({
      value: "personal",
      label: `Remove ~/.copilot agents/skills (${personalCount} items)`,
    });
  }
  if (state.workspacePath && pathExists(state.workspacePath)) {
    options.push({
      value: "workspace",
      label: `Remove workspace file (${path.basename(state.workspacePath)})`,
    });
  }
  const harnessIsPackage =
    path.resolve(state.agentsRoot) === path.resolve(PACKAGE_ROOT);
  if (
    state.agentsRoot &&
    looksLikeHarness(state.agentsRoot) &&
    !harnessIsPackage
  ) {
    options.push({
      value: "harness",
      label: `Delete harness folder (${state.agentsName})`,
      hint:
        state.harnessAction === "copied"
          ? "copied by installer"
          : "already existed — confirm before deleting",
    });
  }
  if (state.codegraphInits?.length) {
    options.push({
      value: "codegraph-indexes",
      label: `Remove .codegraph indexes (${state.codegraphInits.length} product repo${state.codegraphInits.length === 1 ? "" : "s"})`,
    });
  }
  if (state.codegraph || state.codegraphWire || state.codegraphInits?.length) {
    options.push({
      value: "codegraph-wire",
      label: "Unwire CodeGraph from Copilot VS Code (keep CLI)",
    });
  }
  if (state.codegraphCliInstalledByUs) {
    options.push({
      value: "codegraph-cli",
      label: "Uninstall CodeGraph CLI (npm global)",
      hint: "this installer added it",
    });
  }
  if (state.cavemanSkillNames?.length || state.caveman) {
    const n = state.cavemanSkillNames?.length ?? 0;
    options.push({
      value: "caveman-pack",
      label: `Remove optional caveman pack skills${n ? ` (${n})` : ""}`,
      hint: "keeps core caveman chat skill",
    });
  }
  return options;
}

async function runUninstall(args) {
  console.log();
  p.intro(c.bgCyan(c.black(" sdlc-copilot-harness uninstall ")));

  const last = loadInstallState(
    args.parent ? resolveUserPath(args.parent) : null,
  );
  const defaultParent = args.parent
    ? resolveUserPath(args.parent)
    : last?.parentDir || process.cwd();

  let parentDir = defaultParent;
  if (!args.yes) {
    const parentDirRaw = await p.text({
      message: "Parent folder used when installing",
      placeholder: defaultParent,
      initialValue: defaultParent,
      validate(value) {
        const resolved = resolveUserPath(value?.trim() || defaultParent);
        if (!isDirectory(resolved)) return `Not a directory: ${resolved}`;
        return undefined;
      },
    });
    if (p.isCancel(parentDirRaw)) return cancel("Uninstall cancelled.");
    parentDir = resolveUserPath(parentDirRaw.trim() || defaultParent);
  } else if (!isDirectory(parentDir)) {
    throw new Error(`Not a directory: ${parentDir}`);
  }

  const state = discoverInstall(parentDir);
  if (!state.agentsRoot) {
    state.agentsRoot = path.join(parentDir, state.agentsName || "SDLC Harness");
  }
  if (!state.personalPaths) {
    state.personalPaths = discoverPersonalPaths(state.agentsRoot);
  } else {
    const extra = discoverPersonalPaths(state.agentsRoot);
    state.personalPaths = Array.from(new Set([...state.personalPaths, ...extra]));
  }
  if (!Array.isArray(state.codegraphInits)) state.codegraphInits = [];
  state.codegraphInits = state.codegraphInits.map((item) => ({
    ...item,
    path: item.path || path.join(parentDir, item.name),
  }));

  p.note(
    [
      `Parent:     ${parentDir}`,
      `Harness:    ${state.agentsRoot}${state.discovered ? " (discovered)" : ""}`,
      `Workspace:  ${state.workspacePath || "not found"}`,
      `~/.copilot: ${state.personalPaths.length} item(s)`,
      `CodeGraph:  ${state.codegraphInits.length} index(es)${state.codegraphWire ? `, wire=${state.codegraphWire}` : ""}`,
      `Caveman:    ${(state.cavemanSkillNames || []).length} optional pack skill(s)`,
    ].join("\n"),
    "Found",
  );

  const options = buildUninstallOptions(state);
  if (options.length === 0) {
    clearInstallState(parentDir);
    p.outro("Nothing to uninstall.");
    return;
  }

  let selected;
  if (args.yes) {
    selected = defaultUninstallTargets(state, args).filter((id) =>
      options.some((o) => o.value === id),
    );
  } else {
    const picked = await p.multiselect({
      message: "What should be removed?",
      options,
      initialValues: defaultUninstallTargets(state, args).filter((id) =>
        options.some((o) => o.value === id),
      ),
      required: false,
    });
    if (p.isCancel(picked)) return cancel("Uninstall cancelled.");
    selected = picked.map(String);
  }

  if (selected.length === 0) {
    p.outro("Nothing selected. Left as-is.");
    return;
  }

  if (!args.yes) {
    const ok = await p.confirm({
      message: `Remove ${selected.length} item group${selected.length === 1 ? "" : "s"}? This cannot be undone.`,
      initialValue: true,
    });
    if (p.isCancel(ok) || !ok) return cancel("Uninstall cancelled.");
  }

  const s = p.spinner();
  s.start("Uninstalling");
  const report = [];

  if (selected.includes("personal")) {
    const removed = uninstallPersonal(state.personalPaths);
    report.push(`~/.copilot: removed ${removed.length} item(s)`);
  }
  if (selected.includes("codegraph-indexes")) {
    const lines = uninstallCodegraphIndexes(state.codegraphInits);
    report.push(...lines.map((l) => `CodeGraph: ${l}`));
  }
  if (selected.includes("codegraph-wire")) {
    report.push(`CodeGraph: ${uninstallCodegraphWire(state.codegraphWire)}`);
  }
  if (selected.includes("codegraph-cli")) {
    report.push(...uninstallCodegraphCli().map((l) => `CodeGraph: ${l}`));
  }
  if (selected.includes("caveman-pack")) {
    report.push(
      ...uninstallCavemanSkills(state).map((l) => `Caveman: ${l}`),
    );
  }
  if (selected.includes("workspace") && state.workspacePath) {
    report.push(
      removePath(state.workspacePath)
        ? `Workspace: removed ${state.workspacePath}`
        : `Workspace: already gone (${state.workspacePath})`,
    );
  }
  if (selected.includes("harness")) {
    if (path.resolve(state.agentsRoot) === path.resolve(PACKAGE_ROOT)) {
      report.push("Harness: skipped (this is the package itself)");
    } else if (removePath(state.agentsRoot)) {
      report.push(`Harness: removed ${state.agentsRoot}`);
    } else {
      report.push(`Harness: already gone (${state.agentsRoot})`);
    }
  }

  clearInstallState(parentDir);
  s.stop("Uninstall complete");
  p.note(report.join("\n"), "Removed");
  p.outro(c.green("Done. Restart VS Code / Copilot if it was open."));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.uninstall) {
    await runUninstall(args);
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

  let cavemanLines = [];
  let cavemanSkillNames = [];
  if (config.caveman) {
    s.stop("Harness ready");
    p.log.step("Installing optional caveman skill pack…");
    const cavemanResult = setupCavemanSkills({ agentsRoot });
    cavemanLines = cavemanResult.lines;
    cavemanSkillNames = cavemanResult.skillNames;
    p.note(cavemanLines.join("\n"), "Caveman");
    s.start("Finishing install");
  }

  let personalLines = [];
  let personalPaths = [];
  if (config.personal) {
    const personal = installPersonalCopilot(agentsRoot, config.personalMode);
    personalLines = personal.lines;
    personalPaths = personal.paths;
  }

  s.stop("Install complete");

  const state = {
    version: 1,
    installedAt: new Date().toISOString(),
    parentDir: config.parentDir,
    agentsName: config.agentsName,
    agentsRoot,
    harnessAction: action,
    workspacePath,
    workspaceFileName: config.workspaceFileName,
    selectedFolders: config.selectedFolders,
    personal: config.personal,
    personalMode: config.personalMode,
    personalPaths,
    codegraph: config.codegraph,
    codegraphCliInstalledByUs: false,
    codegraphWire: null,
    codegraphInits: [],
    caveman: config.caveman,
    cavemanSkillNames,
  };
  writeInstallState(state);

  let codegraphLines = [];
  if (config.codegraph) {
    p.log.step("Setting up CodeGraph (CLI, Copilot wire, init per product repo)…");
    const result = setupAndInitCodegraph({
      parentDir: config.parentDir,
      agentsName: config.agentsName,
      selectedFolders: config.selectedFolders,
    });
    codegraphLines = result.lines;
    state.codegraphCliInstalledByUs = result.cliInstalledByUs;
    state.codegraphWire = result.wireTarget;
    state.codegraphInits = result.inits.map((item) => ({
      ...item,
      path: path.join(config.parentDir, item.name),
    }));
    writeInstallState(state);
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
    caveman: config.caveman,
    cavemanLines,
  });
}

main().catch((err) => {
  console.error(c.red(err.message || String(err)));
  process.exit(1);
});
