# Setup

## Prerequisites

- VS Code with GitHub Copilot (Chat / agent mode)
- Git
- Azure CLI (`az`) + DevOps extension
- CodeGraph CLI
- Access to your Azure DevOps org/project and Git repos

## 1. Place the harness (npx)

```bash
npx sdlc-copilot-harness
```

Prompts for parent folder, harness name, sibling folders, workspace filename, and optional `~/.copilot` install. Writes `sdlc.code-workspace` into the parent with real folder entries and `chat.agentFilesLocations` pointed at the harness.

Until the package is on npm:

```bash
cd /path/to/Agents
npm install
node bin/install.mjs
```

Non-interactive:

```bash
node bin/install.mjs --yes --parent ~/dev --folders Agents,Contoso.Api,Fabrikam.Web --no-personal
```

Layout after install:

```text
dev/
  Agents/                 # harness (.github/agents, skills, …)
  Contoso.Api/
  Fabrikam.Web/
  ...
  sdlc.code-workspace
```

Then **File → Open Workspace from File…** in VS Code.

## 2. Azure CLI

```bash
brew install azure-cli   # or platform equivalent
az login
az extension add --name azure-devops --upgrade
az devops configure --defaults organization=https://dev.azure.com/<ORG> project=<PROJECT>
```

## 3. CodeGraph for Copilot (VS Code)

```bash
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
# new terminal
codegraph install --target=copilot-vscode --yes

# per product repo
cd ../product-a && codegraph init
cd ../product-b && codegraph init
```

Restart VS Code so Copilot loads the CodeGraph MCP server.

Upstream: https://github.com/colbymchenry/codegraph

## 4. Optional personal install

From the harness root:

```bash
./scripts/install-copilot-harness.sh
```

Symlinks (or copies) agents and skills into `~/.copilot/` for reuse outside this workspace.

## 5. Verify Copilot sees agents

- Command Palette → **Chat: Configure Custom Agents**
- Confirm harness agents appear (`sdlc-orchestrator`, `analyst`, …)
- If not, check `chat.agentFilesLocations` in the workspace file

## 6. Models

Agents declare preferred models from [GitHub’s model comparison](https://docs.github.com/en/copilot/reference/ai-models/model-comparison). If a model is unavailable on your plan, Copilot falls back per the agent’s model list / picker.

## 7. Push harness to Azure DevOps

```bash
az repos create --name Agents   # if needed
git remote add origin https://dev.azure.com/<ORG>/<PROJECT>/_git/Agents
git add -A && git commit -m "Initial SDLC Copilot harness"
git push -u origin main
```
