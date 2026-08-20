#!/usr/bin/env node
/**
 * npx sdlc-copilot-harness
 *
 * Interactive installer:
 * - asks for parent folder that holds sibling product repos
 * - copies/updates the SDLC Harness into that folder
 * - detects sibling directories and builds sdlc.code-workspace
 * - optionally links agents/skills into ~/.copilot
 *
 * Non-interactive:
 *   npx sdlc-copilot-harness --yes \
 *     --parent ~/dev \
 *     --agents-name "SDLC Harness" \
 *     --workspace sdlc.code-workspace \
 *     --folders "SDLC Harness,Contoso.Api,Fabrikam.Web" \
 *     --personal --personal-mode symlink
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
  -y, --yes                Non-interactive (requires --parent)
  -h, --help
`);
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
    ].join("\n"),
    "Result",
  );

  p.note(
    [
      "1. VS Code → File → Open Workspace from File…",
      `   ${workspacePath}`,
      "2. az login && az extension add --name azure-devops --upgrade",
      "3. codegraph install --target=copilot-vscode --yes",
      "4. codegraph init in each product repo",
      "5. Restart VS Code / Copilot",
      "6. Chat → sdlc-orchestrator (or sdlc-orchestrator-economy)",
    ].join("\n"),
    "Next",
  );

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

  return {
    parentDir,
    agentsName,
    selectedFolders,
    workspaceFileName: workspaceFileName.trim(),
    personal,
    personalMode,
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

  finish({
    parentDir: config.parentDir,
    agentsRoot,
    action,
    workspacePath,
    workspaceDoc,
    personal: config.personal,
    personalMode: config.personalMode,
    personalLines,
  });
}

main().catch((err) => {
  console.error(c.red(err.message || String(err)));
  process.exit(1);
});
