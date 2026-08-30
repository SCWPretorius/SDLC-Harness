# Setup

## Prerequisites

- Git
- Azure CLI (`az`) + DevOps extension
- CodeGraph CLI
- Access to your Azure DevOps org/project and Git repos
- **Copilot:** VS Code with GitHub Copilot (Chat / agent mode)
- **OpenCode:** [OpenCode](https://opencode.ai) CLI, with a provider connected (`/connect`)

## 1. Place the harness (npx)

```bash
npx sdlc-copilot-harness
```

Prompts for parent folder, harness name, sibling folders, **runtimes** (Copilot, OpenCode, or both), workspace filename (Copilot), optional personal install (`~/.copilot` and/or `~/.config/opencode`), and optional **CodeGraph** setup (CLI + wire selected runtimes + `init` in each product repo). Writes `sdlc.code-workspace` into the parent when Copilot is selected. Writes `opencode.json` and `.opencode/agents` into the parent when OpenCode is selected.

Until the package is on npm:

```bash
cd "/path/to/SDLC Harness"
npm install
node bin/install.mjs
```

Non-interactive:

```bash
node bin/install.mjs --yes --parent ~/dev --folders "SDLC Harness,Contoso.Api,Fabrikam.Web" --no-personal --opencode --codegraph --caveman
```

Uninstall (interactive prompts, or `--yes`):

```bash
npx sdlc-copilot-harness uninstall
node bin/install.mjs uninstall --yes --parent ~/dev
```

Removes the workspace file, parent OpenCode config this installer wrote, `~/.copilot` and `~/.config/opencode` links/copies, CodeGraph indexes + Copilot/OpenCode wire, optional caveman pack skills, and the harness folder if this installer copied it. Product repos are left untouched. Use `--keep-harness`, `--keep-workspace`, `--keep-personal`, `--keep-opencode`, `--keep-codegraph`, or `--keep-caveman` to leave pieces in place.

Update (refresh harness files when a newer package is available):

```bash
npx sdlc-copilot-harness update
node bin/install.mjs update --yes --parent ~/dev
```

Compares the installed harness version to the running package (and npm `latest` when reachable). If behind, overwrites agents/skills/docs/scripts from this package (and regenerates OpenCode agents), re-applies `~/.copilot` / `~/.config/opencode` when personal install was used, and refreshes the caveman pack only if it was installed before. Does not rewrite the workspace file or re-init CodeGraph. Git checkouts of the harness should use `git pull` instead.

Flags:

| Flag | Meaning |
|------|---------|
| `--copilot` / `--no-copilot` | GitHub Copilot runtime (workspace + `~/.copilot`). Default **on** with `--yes` |
| `--opencode` / `--no-opencode` | OpenCode runtime (parent `opencode.json` + `.opencode/agents`). Default **off** with `--yes` |
| `--codegraph` | Install CodeGraph CLI if missing, run `codegraph install --target=… --yes` for selected runtimes, then `codegraph init` in each selected folder except the harness |
| `--no-codegraph` | Skip CodeGraph (default with `--yes` unless `--codegraph` is set) |
| `--caveman` | Install optional JuliusBrussee/caveman skill pack into the harness `.github/skills` (does not replace the core `caveman` chat skill) |
| `--no-caveman` | Skip caveman pack (default with `--yes` unless `--caveman` is set) |
| `update` | Refresh an existing install’s harness files if outdated (see above) |
| `uninstall` | Reverse an install (see above) |
| `--keep-opencode` | Uninstall: leave parent `opencode.json` / `.opencode` and `~/.config/opencode` |

Layout after install:

```text
~/dev/
  SDLC Harness/          # harness (.github/agents, .opencode/agents, skills, …)
  Contoso.Api/
  Fabrikam.Web/
  Northwind.Services/
  ...
  sdlc.code-workspace    # Copilot (if selected)
  opencode.json          # OpenCode (if selected)
  .opencode/agents/      # symlink/copy of harness OpenCode agents
```

**Copilot:** File → Open Workspace from File… in VS Code.

**OpenCode:** launch from the parent folder so all sibling repos are visible:

```bash
cd ~/dev
opencode
```

Then Tab to `sdlc-orchestrator`. Do not start OpenCode from a product git root unless you also used the personal `~/.config/opencode` install — discovery stops at that repo’s git root.

## 2. Azure CLI

```bash
brew install azure-cli   # or platform equivalent
az login
az extension add --name azure-devops --upgrade
az devops configure --defaults organization=https://dev.azure.com/<ORG> project=<PROJECT>
```

## 3. CodeGraph

**Preferred:** answer yes to the installer’s CodeGraph prompt, or pass `--codegraph` in non-interactive mode. That will:

1. Install `@colbymchenry/codegraph` globally if `codegraph` is not on PATH  
2. Run `codegraph install --target=… --yes` for the selected runtimes:
   - Copilot only → `--target=copilot-vscode`
   - OpenCode only → `--target=opencode`
   - Both → `--target=copilot-vscode,opencode`  
   Falls back to `--target=auto` if that fails.
3. Run `codegraph init` in each selected **product** repo (harness folder is skipped)

**Manual:**

```bash
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
# new terminal
codegraph install --target=copilot-vscode,opencode --yes

# per product repo
cd ../Contoso.Api && codegraph init
cd ../Fabrikam.Web && codegraph init
```

Restart VS Code / Copilot and OpenCode so they load the CodeGraph MCP server.

Upstream: https://github.com/colbymchenry/codegraph

## 4. Optional caveman skill pack

The harness always ships the core **`caveman`** chat skill (forced terse chat). The broader JuliusBrussee/caveman pack (commit/review/explore/workflow skills) is **not** in the repo by default.

**Preferred:** answer yes to the installer’s caveman prompt, or pass `--caveman` in non-interactive mode. That clones the upstream pack and copies optional skills into the installed harness `.github/skills/` (core `caveman` is never replaced). Personal `~/.copilot` / `~/.config/opencode` install then picks them up automatically.

```bash
npx sdlc-copilot-harness --yes --parent ~/dev --folders "…" --caveman
```

Skip with `--no-caveman` (default under `--yes`). Uninstall removes the pack with `--keep-caveman` available to leave it.

Upstream: https://github.com/JuliusBrussee/caveman

## 5. Optional personal install

From the harness root:

```bash
./scripts/install-copilot-harness.sh
./scripts/install-opencode-harness.sh
```

Symlinks (or copies) agents and skills into `~/.copilot/` (Copilot) and `~/.config/opencode/` (OpenCode) for reuse outside this workspace. The OpenCode script also merges a marked SDLC block into `~/.config/opencode/AGENTS.md`.

Edit Copilot agents under `.github/agents/`, then regenerate OpenCode files:

```bash
node bin/sync-opencode-agents.mjs
```

## 6. Verify Copilot sees agents

- Command Palette → **Chat: Configure Custom Agents**
- Confirm harness agents appear (`sdlc-orchestrator`, `analyst`, …)
- If not, check `chat.agentFilesLocations` in the workspace file

## 7. Verify OpenCode sees agents

- `cd` to the parent folder (same directory as `opencode.json` / the workspace file)
- Run `opencode`
- Tab-cycle until **`sdlc-orchestrator`** (or `sdlc-orchestrator-economy`)
- `@analyst` (and other specialists) should complete in the mention menu
- If agents are missing, confirm parent `.opencode/agents` exists or that personal install linked `~/.config/opencode/agents`

## 8. Models

**Copilot:** agents declare one preferred model from [GitHub’s model comparison](https://docs.github.com/en/copilot/reference/ai-models/model-comparison) (see [README](../README.md) and [MODEL-IDS.md](MODEL-IDS.md)). If that model is unavailable on your plan, use the Copilot model picker.

**OpenCode:** generated agents omit `model` so your connected provider applies. Use `/models` (or `opencode.json` `model`). Optional mapping notes are in [MODEL-IDS.md](MODEL-IDS.md).

## 9. Push harness to Azure DevOps

```bash
az repos create --name SDLC-Harness   # if needed
git remote add origin https://dev.azure.com/<ORG>/<PROJECT>/_git/SDLC-Harness
git add -A && git commit -m "Initial SDLC Copilot harness"
git push -u origin main
```
