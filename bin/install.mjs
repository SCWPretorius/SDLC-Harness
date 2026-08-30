#!/usr/bin/env node
/**
 * npx sdlc-copilot-harness
 *
 * Interactive installer:
 * - asks for parent folder that holds sibling product repos
 * - copies/updates the SDLC Harness into that folder
 * - detects sibling directories and builds sdlc.code-workspace (Copilot)
 * - optionally writes parent opencode.json + .opencode/agents (OpenCode)
 * - optionally links agents/skills into ~/.copilot and/or ~/.config/opencode
 * - optionally installs CodeGraph CLI, wires Copilot and/or OpenCode, inits each product repo
 *
 * Uninstall (reverses the above):
 *   npx sdlc-copilot-harness uninstall
 *   npx sdlc-copilot-harness uninstall --yes --parent ~/dev
 *
 * Update (refresh harness files from this package):
 *   npx sdlc-copilot-harness update
 *   npx sdlc-copilot-harness update --yes --parent ~/dev
 *
 * Non-interactive install:
 *   npx sdlc-copilot-harness --yes \
 *     --parent ~/dev \
 *     --agents-name "SDLC Harness" \
 *     --workspace sdlc.code-workspace \
 *     --folders "SDLC Harness,Contoso.Api,Fabrikam.Web" \
 *     --personal --personal-mode symlink \
 *     --opencode \
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
import { syncOpencodeAgents } from "./sync-opencode-agents.mjs";

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
    copilot: null,
    opencode: null,
    help: false,
    uninstall: false,
    update: false,
    keepPersonal: false,
    keepWorkspace: false,
    keepHarness: false,
    keepCodegraph: false,
    keepCaveman: false,
    keepOpencode: false,
    removeCodegraphCli: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (i === 0 && (a === "uninstall" || a === "install" || a === "update")) {
      if (a === "uninstall") out.uninstall = true;
      if (a === "update") out.update = true;
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
      case "--update":
        out.update = true;
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
      case "--copilot":
        out.copilot = true;
        break;
      case "--no-copilot":
        out.copilot = false;
        break;
      case "--opencode":
        out.opencode = true;
        break;
      case "--no-opencode":
        out.opencode = false;
        break;
      case "--keep-opencode":
        out.keepOpencode = true;
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
  npx sdlc-copilot-harness update
  npx sdlc-copilot-harness update --yes --parent <dir>
  npx sdlc-copilot-harness uninstall
  npx sdlc-copilot-harness uninstall --yes --parent <dir>

Install options:
  --parent <dir>           Parent folder containing sibling repos
  --agents-name <name>     Harness folder name (default: SDLC Harness)
  --workspace <file>       Workspace filename (default: sdlc.code-workspace)
  --folders <a,b,c>        Folders to include (comma-separated)
  --personal / --no-personal
  --personal-mode symlink|copy
  --copilot / --no-copilot
                           GitHub Copilot (VS Code) runtime. Default on with --yes
  --opencode / --no-opencode
                           OpenCode runtime (parent opencode.json). Default off with --yes
  --codegraph / --no-codegraph
                           Install CodeGraph CLI (if needed), wire selected runtimes,
                           and run codegraph init in each selected product repo
  --caveman / --no-caveman
                           Vendor optional JuliusBrussee/caveman skill pack into the
                           harness .github/skills (does not replace core caveman)
  -y, --yes                Non-interactive (install requires --parent)
  -h, --help

Update options:
  update, --update         Refresh harness files from this package if outdated
  --parent <dir>           Parent folder used at install (or last-install is used)
  -y, --yes                Non-interactive update

Uninstall options:
  uninstall, --uninstall   Remove what this installer created
  --parent <dir>           Parent folder used at install (or last-install is used)
  --keep-personal          Leave ~/.copilot agents/skills in place
  --keep-workspace         Leave the .code-workspace file
  --keep-harness           Leave the harness folder
  --keep-codegraph         Leave CodeGraph indexes and Copilot/OpenCode wire
  --keep-caveman           Leave optional caveman pack skills in the harness
  --keep-opencode          Leave parent opencode.json / .opencode and ~/.config/opencode
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

function codegraphWireTarget({ copilot, opencode }) {
  if (copilot && opencode) return "copilot-vscode,opencode";
  if (opencode) return "opencode";
  return "copilot-vscode";
}

function setupAndInitCodegraph({
  parentDir,
  agentsName,
  selectedFolders,
  copilot = true,
  opencode = false,
}) {
  const lines = [];
  const { runner, installed } = ensureCodegraphCli();
  lines.push(
    installed
      ? `CLI: installed @colbymchenry/codegraph (${runner.label})`
      : `CLI: using ${runner.label}`,
  );

  const preferred = codegraphWireTarget({ copilot, opencode });
  let wireTarget = preferred;
  const wire = runCodegraph(runner, [
    "install",
    `--target=${preferred}`,
    "--yes",
  ]);
  if (!wire.ok) {
    const fallback = runCodegraph(runner, ["install", "--target=auto", "--yes"]);
    if (!fallback.ok) {
      throw new Error(
        `codegraph install failed (tried --target=${preferred} and --target=auto)`,
      );
    }
    wireTarget = "auto";
    lines.push("Wire: codegraph install --target=auto --yes");
  } else {
    lines.push(`Wire: codegraph install --target=${preferred} --yes`);
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

const SDLC_AGENTS_BEGIN = "<!-- SDLC-HARNESS:BEGIN -->";
const SDLC_AGENTS_END = "<!-- SDLC-HARNESS:END -->";

function wrapSdlcAgentsBlock(body) {
  return `${SDLC_AGENTS_BEGIN}\n${String(body).trim()}\n${SDLC_AGENTS_END}\n`;
}

function upsertMarkedBlock(file, body) {
  const block = wrapSdlcAgentsBlock(body);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!pathExists(file)) {
    fs.writeFileSync(file, block, "utf8");
    return "created";
  }
  const current = fs.readFileSync(file, "utf8");
  const start = current.indexOf(SDLC_AGENTS_BEGIN);
  const end = current.indexOf(SDLC_AGENTS_END);
  if (start !== -1 && end !== -1 && end > start) {
    const after = current.slice(end + SDLC_AGENTS_END.length).replace(/^\r?\n/, "");
    fs.writeFileSync(file, `${current.slice(0, start)}${block}${after}`, "utf8");
    return "updated";
  }
  const sep = current.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(file, `${current}${sep}${block}`, "utf8");
  return "appended";
}

function removeMarkedBlock(file) {
  if (!pathExists(file)) return false;
  const current = fs.readFileSync(file, "utf8");
  const start = current.indexOf(SDLC_AGENTS_BEGIN);
  const end = current.indexOf(SDLC_AGENTS_END);
  if (start === -1 || end === -1 || end < start) return false;
  let next = `${current.slice(0, start)}${current.slice(end + SDLC_AGENTS_END.length)}`;
  next = next.replace(/^\s+/, "").replace(/\s+$/, "");
  if (!next) {
    fs.rmSync(file, { force: true });
  } else {
    fs.writeFileSync(file, next.endsWith("\n") ? next : `${next}\n`, "utf8");
  }
  return true;
}

function posixJoin(...parts) {
  return parts
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");
}

function buildParentOpencodeJson(agentsName) {
  const prefix = posixJoin(".", agentsName);
  return {
    $schema: "https://opencode.ai/config.json",
    default_agent: "sdlc-orchestrator",
    instructions: [
      posixJoin(prefix, ".github/copilot-instructions.md"),
      posixJoin(prefix, ".github/instructions/*.md"),
      posixJoin(prefix, "AGENTS.md"),
    ],
    skills: [posixJoin(prefix, ".github/skills")],
  };
}

function installParentOpencode(parentDir, agentsName, agentsRoot, mode) {
  const jsonPath = path.join(parentDir, "opencode.json");
  const agentsDest = path.join(parentDir, ".opencode", "agents");
  const agentsSrc = path.join(agentsRoot, ".opencode", "agents");
  const lines = [];
  const paths = [];

  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify(buildParentOpencodeJson(agentsName), null, 2)}\n`,
    "utf8",
  );
  lines.push(`wrote ${jsonPath}`);
  paths.push(jsonPath);

  if (!isDirectory(agentsSrc)) {
    throw new Error(`OpenCode agents missing at ${agentsSrc}`);
  }
  lines.push(linkOrCopy(agentsSrc, agentsDest, mode));
  paths.push(agentsDest);

  return { lines, paths, jsonPath, agentsDest };
}

function installPersonalOpencode(agentsRoot, mode) {
  const targetBase = path.join(os.homedir(), ".config", "opencode");
  const agentsSrc = path.join(agentsRoot, ".opencode", "agents");
  const skillsSrc = path.join(agentsRoot, ".github", "skills");
  const lines = [];
  const paths = [];

  fs.mkdirSync(path.join(targetBase, "agents"), { recursive: true });
  fs.mkdirSync(path.join(targetBase, "skills"), { recursive: true });

  if (isDirectory(agentsSrc)) {
    for (const f of fs.readdirSync(agentsSrc)) {
      if (!f.endsWith(".md")) continue;
      const dest = path.join(targetBase, "agents", f);
      lines.push(linkOrCopy(path.join(agentsSrc, f), dest, mode));
      paths.push(dest);
    }
  }

  if (isDirectory(skillsSrc)) {
    for (const name of fs.readdirSync(skillsSrc)) {
      const src = path.join(skillsSrc, name);
      if (!isDirectory(src)) continue;
      const dest = path.join(targetBase, "skills", name);
      lines.push(linkOrCopy(src, dest, mode));
      paths.push(dest);
    }
  }

  const agentsMdSrc = path.join(agentsRoot, "AGENTS.md");
  const agentsMdDest = path.join(targetBase, "AGENTS.md");
  if (fs.existsSync(agentsMdSrc)) {
    const action = upsertMarkedBlock(
      agentsMdDest,
      fs.readFileSync(agentsMdSrc, "utf8"),
    );
    lines.push(`AGENTS.md: ${action} ${agentsMdDest}`);
  }

  return { lines, paths, agentsMdPath: agentsMdDest };
}

function refreshOpencodeAgents(agentsRoot) {
  if (!fs.existsSync(path.join(agentsRoot, ".github", "agents"))) {
    return { written: [], removed: [], skipped: true };
  }
  return syncOpencodeAgents(agentsRoot);
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
  copilot,
  opencode,
  personal,
  personalMode,
  personalLines,
  opencodePersonalLines,
  opencodeParentLines,
  codegraph,
  codegraphLines,
  caveman,
  cavemanLines,
}) {
  const folderNames = workspaceDoc?.folders?.map((f) => f.name).join(", ");
  const result = [
    `Parent:     ${parentDir}`,
    `Harness:    ${agentsRoot} (${action})`,
    copilot
      ? `Workspace:  ${workspacePath}`
      : "Workspace:  skipped (Copilot off)",
    folderNames ? `Folders:    ${folderNames}` : null,
    copilot
      ? personal
        ? `~/.copilot: ${(personalLines || []).length} links/copies (${personalMode})`
        : "~/.copilot: skipped"
      : null,
    opencode
      ? `OpenCode:   parent config${(opencodeParentLines || []).length ? ` (${opencodeParentLines.length} writes)` : ""}`
      : "OpenCode:   skipped",
    opencode
      ? personal
        ? `~/.config/opencode: ${(opencodePersonalLines || []).length} links/copies (${personalMode})`
        : "~/.config/opencode: skipped"
      : null,
    codegraph
      ? `CodeGraph:  set up (${(codegraphLines || []).filter((l) => l.startsWith("Init:")).length} repo inits)`
      : "CodeGraph:  skipped",
    caveman
      ? `Caveman:    pack installed (${(cavemanLines || []).filter((l) => l.startsWith("Skill:")).length} skills)`
      : "Caveman:    pack skipped (core chat skill still in harness)",
  ].filter(Boolean);

  p.note(result.join("\n"), "Result");

  const next = [];
  let n = 1;
  if (copilot && workspacePath) {
    next.push(`${n++}. VS Code → File → Open Workspace from File…`);
    next.push(`   ${workspacePath}`);
  }
  if (opencode) {
    next.push(`${n++}. cd "${parentDir}" && opencode`);
    next.push("   Tab → sdlc-orchestrator (or sdlc-orchestrator-economy)");
  }
  next.push(
    `${n++}. az login && az extension add --name azure-devops --upgrade`,
  );
  if (codegraph) {
    const restart = [
      copilot ? "VS Code / Copilot" : null,
      opencode ? "OpenCode" : null,
    ]
      .filter(Boolean)
      .join(" and ");
    next.push(`${n++}. Restart ${restart} (loads CodeGraph MCP)`);
    if (copilot) {
      next.push(
        `${n++}. Copilot Chat → sdlc-orchestrator (or sdlc-orchestrator-economy)`,
      );
    }
  } else {
    const targets = codegraphWireTarget({
      copilot: !!copilot,
      opencode: !!opencode,
    });
    next.push(`${n++}. codegraph install --target=${targets} --yes`);
    next.push(`${n++}. codegraph init in each product repo`);
    if (copilot) {
      next.push(`${n++}. Restart VS Code / Copilot`);
      next.push(
        `${n++}. Copilot Chat → sdlc-orchestrator (or sdlc-orchestrator-economy)`,
      );
    }
    if (opencode) {
      next.push(`${n++}. Restart OpenCode if it was already running`);
    }
  }
  next.push("To remove later: npx sdlc-copilot-harness uninstall");

  p.note(next.join("\n"), "Next");

  const outro = copilot
    ? "Done. Open the workspace and start with sdlc-orchestrator."
    : "Done. Launch OpenCode from the parent folder and Tab to sdlc-orchestrator.";
  p.outro(c.green(outro));
}

function runtimeInitial(args) {
  if (args.copilot === false && args.opencode === true) return "opencode";
  if (args.opencode === false && args.copilot !== false) return "copilot";
  return "both";
}

function personalPrompt(copilot, opencode) {
  if (copilot && opencode) {
    return {
      confirm: "Also install agents/skills for personal use? (~/.copilot and ~/.config/opencode)",
      mode: "Personal install mode (~/.copilot and ~/.config/opencode)",
    };
  }
  if (opencode) {
    return {
      confirm: "Also install agents/skills into ~/.config/opencode for personal use?",
      mode: "~/.config/opencode install mode",
    };
  }
  return {
    confirm: "Also install agents/skills into ~/.copilot for personal use?",
    mode: "~/.copilot install mode",
  };
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
    message: "Folders to include (product repos + harness)",
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

  const runtime = await p.select({
    message: "Which agent runtimes?",
    options: [
      {
        value: "both",
        label: "GitHub Copilot (VS Code) and OpenCode",
        hint: "recommended",
      },
      { value: "copilot", label: "GitHub Copilot (VS Code) only" },
      { value: "opencode", label: "OpenCode only" },
    ],
    initialValue: runtimeInitial(args),
  });
  if (p.isCancel(runtime)) return cancel();
  const copilot = runtime !== "opencode";
  const opencode = runtime !== "copilot";

  let workspaceFileName = args.workspace || "sdlc.code-workspace";
  if (copilot) {
    const workspaceRaw = await p.text({
      message: "Workspace file name (written into the parent folder)",
      initialValue: workspaceFileName,
      validate(v) {
        if (!v?.trim()) return "Required";
        if (!v.endsWith(".code-workspace")) {
          return "Must end with .code-workspace";
        }
        return undefined;
      },
    });
    if (p.isCancel(workspaceRaw)) return cancel();
    workspaceFileName = workspaceRaw.trim();
  }

  const prompt = personalPrompt(copilot, opencode);
  const personal = await p.confirm({
    message: prompt.confirm,
    initialValue: args.personal ?? true,
  });
  if (p.isCancel(personal)) return cancel();

  let personalMode = args.personalMode || "symlink";
  if (personal) {
    const mode = await p.select({
      message: prompt.mode,
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
  const wire = codegraphWireTarget({ copilot, opencode });
  const codegraph = await p.confirm({
    message: `Set up CodeGraph? (CLI if needed, wire ${wire}, init ${productCount} product repo${productCount === 1 ? "" : "s"})`,
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
    workspaceFileName,
    copilot,
    opencode,
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
  const copilot = args.copilot ?? true;
  const opencode = args.opencode ?? false;
  if (!copilot && !opencode) {
    throw new Error(
      "Select at least one runtime: Copilot (--copilot) and/or OpenCode (--opencode)",
    );
  }
  return {
    parentDir,
    agentsName,
    selectedFolders,
    workspaceFileName: args.workspace || "sdlc.code-workspace",
    copilot,
    opencode,
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

function readPackageVersion(root) {
  const pkg = readJsonFile(path.join(root, "package.json"));
  return typeof pkg?.version === "string" ? pkg.version : null;
}

function getRunningPackageVersion() {
  return readPackageVersion(PACKAGE_ROOT) || "0.0.0";
}

/** Compare dotted numeric versions (e.g. 1.0.2). Returns -1 / 0 / 1. */
function compareVersions(a, b) {
  const pa = String(a || "0")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

function fetchNpmLatestVersion(packageName = "sdlc-copilot-harness") {
  if (!commandExists("npm")) return null;
  try {
    const result = spawnSync(
      "npm",
      ["view", packageName, "version", "--silent"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
        timeout: 15000,
      },
    );
    if (result.status !== 0) return null;
    const v = (result.stdout || "").trim();
    return v || null;
  } catch {
    return null;
  }
}

function resolveInstalledVersion(agentsRoot, state) {
  return (
    readPackageVersion(agentsRoot) ||
    (typeof state?.packageVersion === "string" ? state.packageVersion : null)
  );
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

function listHarnessOpencodeAgentFiles(agentsRoot) {
  const dir = path.join(agentsRoot, ".opencode", "agents");
  const src = isDirectory(dir)
    ? dir
    : path.join(PACKAGE_ROOT, ".opencode", "agents");
  if (!isDirectory(src)) return [];
  return fs.readdirSync(src).filter((f) => f.endsWith(".md"));
}

function discoverPersonalOpencodePaths(agentsRoot) {
  const targetBase = path.join(os.homedir(), ".config", "opencode");
  const agentsRootResolved = path.resolve(agentsRoot);
  const found = [];

  for (const f of listHarnessOpencodeAgentFiles(agentsRoot)) {
    const dest = path.join(targetBase, "agents", f);
    if (shouldRemovePersonalPath(dest, agentsRootResolved)) found.push(dest);
  }
  for (const name of listHarnessSkillNames(agentsRoot)) {
    const dest = path.join(targetBase, "skills", name);
    if (shouldRemovePersonalPath(dest, agentsRootResolved)) found.push(dest);
  }
  return found;
}

function discoverOpencodeParent(parentDir, agentsRoot) {
  const jsonPath = path.join(parentDir, "opencode.json");
  const agentsDest = path.join(parentDir, ".opencode", "agents");
  const paths = [];
  if (pathExists(jsonPath)) {
    const doc = readJsonFile(jsonPath);
    const looksOurs =
      doc?.default_agent === "sdlc-orchestrator" ||
      JSON.stringify(doc || {}).includes(".github/skills");
    if (looksOurs) paths.push(jsonPath);
  }
  if (pathExists(agentsDest)) {
    try {
      const st = fs.lstatSync(agentsDest);
      if (st.isSymbolicLink()) {
        if (shouldRemovePersonalPath(agentsDest, path.resolve(agentsRoot))) {
          paths.push(agentsDest);
        }
      } else if (st.isDirectory() && isDirectory(path.join(agentsRoot, ".opencode", "agents"))) {
        paths.push(agentsDest);
      }
    } catch {
      /* ignore */
    }
  }
  return paths;
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
  const opencodePersonalPaths = discoverPersonalOpencodePaths(agentsRoot);
  const opencodeParentPaths = discoverOpencodeParent(parentDir, agentsRoot);
  const opencodeJsonPath = path.join(parentDir, "opencode.json");
  const opencodeAgentsPath = path.join(parentDir, ".opencode", "agents");
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
    copilot: personalPaths.length > 0 || Boolean(workspaceFile),
    opencode: opencodeParentPaths.length > 0 || opencodePersonalPaths.length > 0,
    opencodeJsonPath: pathExists(opencodeJsonPath) ? opencodeJsonPath : null,
    opencodeAgentsPath: pathExists(opencodeAgentsPath)
      ? opencodeAgentsPath
      : null,
    opencodeParentPaths,
    opencodePersonal: opencodePersonalPaths.length > 0,
    opencodePersonalPaths,
    opencodePersonalAgentsMd: path.join(
      os.homedir(),
      ".config",
      "opencode",
      "AGENTS.md",
    ),
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
    return "CodeGraph CLI not on PATH; skipped Copilot/OpenCode unwire";
  }
  const raw = wireTarget === "auto" ? "copilot-vscode" : (wireTarget || "copilot-vscode");
  const targets = raw.split(",").map((t) => t.trim()).filter(Boolean);
  const lines = [];
  for (const target of targets) {
    const result = runCodegraph(runner, [
      "uninstall",
      `--target=${target}`,
      "--yes",
      "--keep-cli",
    ]);
    if (!result.ok) {
      lines.push(`codegraph uninstall --target=${target} failed (CLI left in place)`);
    } else {
      lines.push(`unwired CodeGraph from ${target}`);
    }
  }
  return lines.join("; ");
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
    !args.keepOpencode &&
    (state.opencodeParentPaths?.length ||
      state.opencodeJsonPath ||
      state.opencodeAgentsPath)
  ) {
    selected.push("opencode-parent");
  }
  if (
    !args.keepOpencode &&
    (state.opencodePersonalPaths?.length || state.opencodePersonal)
  ) {
    selected.push("opencode-personal");
  }
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
  const opencodeParentCount = [
    state.opencodeJsonPath,
    state.opencodeAgentsPath,
    ...(state.opencodeParentPaths || []),
  ].filter(Boolean).length;
  if (
    state.opencodeJsonPath ||
    state.opencodeAgentsPath ||
    state.opencodeParentPaths?.length
  ) {
    options.push({
      value: "opencode-parent",
      label: "Remove parent opencode.json and .opencode/agents",
      hint: `${opencodeParentCount} path(s)`,
    });
  }
  const opencodePersonalCount = state.opencodePersonalPaths?.length ?? 0;
  if (opencodePersonalCount > 0 || state.opencodePersonal) {
    options.push({
      value: "opencode-personal",
      label: `Remove ~/.config/opencode agents/skills${opencodePersonalCount ? ` (${opencodePersonalCount} items)` : ""}`,
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
      label: `Unwire CodeGraph from ${state.codegraphWire || "configured agents"} (keep CLI)`,
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
  if (!state.opencodePersonalPaths) {
    state.opencodePersonalPaths = discoverPersonalOpencodePaths(state.agentsRoot);
  } else {
    const extra = discoverPersonalOpencodePaths(state.agentsRoot);
    state.opencodePersonalPaths = Array.from(
      new Set([...state.opencodePersonalPaths, ...extra]),
    );
  }
  if (!state.opencodeParentPaths) {
    state.opencodeParentPaths = discoverOpencodeParent(parentDir, state.agentsRoot);
  }
  if (!state.opencodeJsonPath) {
    const jsonPath = path.join(parentDir, "opencode.json");
    if (pathExists(jsonPath)) state.opencodeJsonPath = jsonPath;
  }
  if (!state.opencodeAgentsPath) {
    const agentsDest = path.join(parentDir, ".opencode", "agents");
    if (pathExists(agentsDest)) state.opencodeAgentsPath = agentsDest;
  }
  if (!state.opencodePersonalAgentsMd) {
    state.opencodePersonalAgentsMd = path.join(
      os.homedir(),
      ".config",
      "opencode",
      "AGENTS.md",
    );
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
      `OpenCode:   ${(state.opencodeParentPaths || []).length} parent path(s), ${(state.opencodePersonalPaths || []).length} personal item(s)`,
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
  if (selected.includes("opencode-personal")) {
    const removed = uninstallPersonal(state.opencodePersonalPaths || []);
    if (state.opencodePersonalAgentsMd) {
      if (removeMarkedBlock(state.opencodePersonalAgentsMd)) {
        report.push("OpenCode: removed SDLC block from ~/.config/opencode/AGENTS.md");
      }
    }
    report.push(`~/.config/opencode: removed ${removed.length} item(s)`);
  }
  if (selected.includes("opencode-parent")) {
    const parentPaths = Array.from(
      new Set(
        [
          state.opencodeJsonPath,
          state.opencodeAgentsPath,
          ...(state.opencodeParentPaths || []),
        ].filter(Boolean),
      ),
    );
    const removed = uninstallPersonal(parentPaths);
    const opencodeDir = path.join(parentDir, ".opencode");
    if (isDirectory(opencodeDir) && fs.readdirSync(opencodeDir).length === 0) {
      removePath(opencodeDir);
    }
    report.push(`OpenCode parent: removed ${removed.length} path(s)`);
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
  p.outro(c.green("Done. Restart VS Code / Copilot / OpenCode if they were open."));
}

function refreshHarnessFromPackage(agentsRoot) {
  copyDir(PACKAGE_ROOT, agentsRoot);
  for (const junk of ["node_modules", "package-lock.json"]) {
    const j = path.join(agentsRoot, junk);
    if (fs.existsSync(j)) fs.rmSync(j, { recursive: true, force: true });
  }
}

async function runUpdate(args) {
  console.log();
  p.intro(c.bgCyan(c.black(" sdlc-copilot-harness update ")));

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
    if (p.isCancel(parentDirRaw)) return cancel("Update cancelled.");
    parentDir = resolveUserPath(parentDirRaw.trim() || defaultParent);
  } else if (!isDirectory(parentDir)) {
    throw new Error(`Not a directory: ${parentDir}`);
  }

  const discovered = discoverInstall(parentDir);
  const saved = loadInstallState(parentDir);
  const state = {
    ...discovered,
    ...(saved || {}),
    parentDir,
    agentsRoot:
      saved?.agentsRoot ||
      discovered.agentsRoot ||
      path.join(parentDir, saved?.agentsName || discovered.agentsName || "SDLC Harness"),
    agentsName:
      saved?.agentsName || discovered.agentsName || "SDLC Harness",
  };

  if (!looksLikeHarness(state.agentsRoot)) {
    throw new Error(
      `No harness found at ${state.agentsRoot}. Run install first, or pass --parent.`,
    );
  }

  if (path.resolve(state.agentsRoot) === path.resolve(PACKAGE_ROOT)) {
    p.outro(
      "This folder is the package itself (current checkout). Already running these files — nothing to refresh. Use git pull if you need upstream changes.",
    );
    return;
  }

  const harnessAction =
    state.harnessAction || inferHarnessAction(state.agentsRoot);
  const isGitCheckout = pathExists(path.join(state.agentsRoot, ".git"));
  if (harnessAction === "existing" && isGitCheckout) {
    throw new Error(
      `Harness at ${state.agentsRoot} is a git checkout. Update with git pull instead of this command.`,
    );
  }

  const runningVersion = getRunningPackageVersion();
  const installedVersion = resolveInstalledVersion(state.agentsRoot, state);
  const npmLatest = fetchNpmLatestVersion();

  const versionLines = [
    `Installed:  ${installedVersion || "(unknown)"}`,
    `Running:    ${runningVersion}`,
    npmLatest
      ? `npm latest: ${npmLatest}`
      : "npm latest: (unavailable)",
    `Harness:    ${state.agentsRoot}`,
  ];
  p.note(versionLines.join("\n"), "Versions");

  if (npmLatest && compareVersions(runningVersion, npmLatest) < 0) {
    p.log.warn(
      `A newer package is on npm (${npmLatest}). Re-run via npx sdlc-copilot-harness update so this updater is current, then refresh again.`,
    );
  }

  if (
    installedVersion &&
    compareVersions(installedVersion, runningVersion) >= 0
  ) {
    p.outro(
      c.green(
        `Already up to date (${installedVersion}). Workspace and CodeGraph left as-is.`,
      ),
    );
    return;
  }

  if (!args.yes) {
    const ok = await p.confirm({
      message: `Refresh harness ${installedVersion || "unknown"} → ${runningVersion}? Keeps workspace and CodeGraph.`,
      initialValue: true,
    });
    if (p.isCancel(ok) || !ok) return cancel("Update cancelled.");
  }

  const s = p.spinner();
  s.start("Refreshing harness files");
  refreshHarnessFromPackage(state.agentsRoot);
  refreshOpencodeAgents(state.agentsRoot);
  s.stop(`Harness refreshed → ${runningVersion}`);

  const report = [
    `Harness: ${installedVersion || "unknown"} → ${runningVersion}`,
  ];

  if (state.caveman || state.cavemanSkillNames?.length) {
    p.log.step("Refreshing optional caveman skill pack…");
    const cavemanResult = setupCavemanSkills({ agentsRoot: state.agentsRoot });
    state.caveman = true;
    state.cavemanSkillNames = cavemanResult.skillNames;
    report.push(
      `Caveman: refreshed ${cavemanResult.skillNames.length} pack skill(s)`,
    );
    p.note(cavemanResult.lines.join("\n"), "Caveman");
  }

  const mode = state.personalMode || "symlink";
  const copilotRuntime = state.copilot !== false;
  const opencodeRuntime = Boolean(
    state.opencode || state.opencodeJsonPath || state.opencodeAgentsPath,
  );

  if (state.personal && copilotRuntime) {
    const personal = installPersonalCopilot(state.agentsRoot, mode);
    state.personalPaths = personal.paths;
    state.personalMode = mode;
    report.push(
      `~/.copilot: re-applied ${personal.paths.length} item(s) (${mode})`,
    );
  }

  if (opencodeRuntime) {
    const parent = installParentOpencode(
      parentDir,
      state.agentsName,
      state.agentsRoot,
      mode,
    );
    state.opencode = true;
    state.opencodeJsonPath = parent.jsonPath;
    state.opencodeAgentsPath = parent.agentsDest;
    state.opencodeParentPaths = parent.paths;
    report.push(`OpenCode parent: re-applied ${parent.paths.length} path(s)`);

    if (state.personal || state.opencodePersonal) {
      const ocPersonal = installPersonalOpencode(state.agentsRoot, mode);
      state.opencodePersonal = true;
      state.opencodePersonalPaths = ocPersonal.paths;
      state.opencodePersonalAgentsMd = ocPersonal.agentsMdPath;
      report.push(
        `~/.config/opencode: re-applied ${ocPersonal.paths.length} item(s) (${mode})`,
      );
    }
  }

  state.packageVersion = runningVersion;
  state.updatedAt = new Date().toISOString();
  state.harnessAction = "copied";
  writeInstallState(state);

  p.note(report.join("\n"), "Updated");
  p.outro(
    c.green(
      "Done. Restart VS Code / Copilot / OpenCode if agents were open. Workspace and CodeGraph were left as-is.",
    ),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.update) {
    await runUpdate(args);
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
  s.start("Installing harness");

  const { dest: agentsRoot, action } = ensureHarness(
    config.parentDir,
    config.agentsName,
  );
  refreshOpencodeAgents(agentsRoot);

  let workspaceDoc = null;
  let workspacePath = null;
  if (config.copilot) {
    workspaceDoc = buildWorkspace({
      agentsFolderName: config.agentsName,
      selectedFolders: config.selectedFolders,
    });
    workspacePath = writeWorkspaceFile(
      config.parentDir,
      config.workspaceFileName,
      workspaceDoc,
    );
  }

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
  if (config.personal && config.copilot) {
    const personal = installPersonalCopilot(agentsRoot, config.personalMode);
    personalLines = personal.lines;
    personalPaths = personal.paths;
  }

  let opencodeParentLines = [];
  let opencodeParentPaths = [];
  let opencodeJsonPath = null;
  let opencodeAgentsPath = null;
  let opencodePersonalLines = [];
  let opencodePersonalPaths = [];
  let opencodePersonalAgentsMd = null;
  if (config.opencode) {
    const parent = installParentOpencode(
      config.parentDir,
      config.agentsName,
      agentsRoot,
      config.personalMode || "symlink",
    );
    opencodeParentLines = parent.lines;
    opencodeParentPaths = parent.paths;
    opencodeJsonPath = parent.jsonPath;
    opencodeAgentsPath = parent.agentsDest;
    if (config.personal) {
      const ocPersonal = installPersonalOpencode(agentsRoot, config.personalMode);
      opencodePersonalLines = ocPersonal.lines;
      opencodePersonalPaths = ocPersonal.paths;
      opencodePersonalAgentsMd = ocPersonal.agentsMdPath;
    }
  }

  s.stop("Install complete");

  const state = {
    version: 1,
    installedAt: new Date().toISOString(),
    packageVersion: getRunningPackageVersion(),
    parentDir: config.parentDir,
    agentsName: config.agentsName,
    agentsRoot,
    harnessAction: action,
    workspacePath,
    workspaceFileName: config.copilot ? config.workspaceFileName : null,
    selectedFolders: config.selectedFolders,
    copilot: config.copilot,
    opencode: config.opencode,
    personal: config.personal,
    personalMode: config.personalMode,
    personalPaths,
    opencodeJsonPath,
    opencodeAgentsPath,
    opencodeParentPaths,
    opencodePersonal: Boolean(config.opencode && config.personal),
    opencodePersonalPaths,
    opencodePersonalAgentsMd,
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
    p.log.step("Setting up CodeGraph (CLI, wire selected runtimes, init per product repo)…");
    const result = setupAndInitCodegraph({
      parentDir: config.parentDir,
      agentsName: config.agentsName,
      selectedFolders: config.selectedFolders,
      copilot: config.copilot,
      opencode: config.opencode,
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
    copilot: config.copilot,
    opencode: config.opencode,
    personal: config.personal,
    personalMode: config.personalMode,
    personalLines,
    opencodePersonalLines,
    opencodeParentLines,
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
