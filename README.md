# SDLC Harness (GitHub Copilot / VS Code + OpenCode)

Standalone Azure DevOps–oriented agent harness for **GitHub Copilot in VS Code** and **[OpenCode](https://opencode.ai)**. Ships custom agents, skills, and instructions for a full SDLC loop:

**Analysis → chat PRD → ADO work items → vertical-slice .NET implementation → code review → ADO bugs → fix**

Not for Cursor. Stack: Azure DevOps (`az` CLI), C# .NET 10, Azure platform, Agile process (`Epic → Feature → User Story → Task`).

Copilot agents in `.github/agents/` are the source of truth. OpenCode agents in `.opencode/agents/` are generated (`node bin/sync-opencode-agents.mjs`).

## Quick start

### Install with npx (recommended)

From any machine with Node 18+:

```bash
npx sdlc-copilot-harness
```

The installer asks for:

1. **Parent folder** — directory that holds sibling product repos  
2. **Harness folder name** — default `SDLC Harness` (created/copied if missing)  
3. **Which sibling folders** to put in the workspace  
4. **Runtimes** — GitHub Copilot (VS Code), OpenCode, or both  
5. **Workspace file name** — default `sdlc.code-workspace` (Copilot; written into the parent)  
6. Optional **personal install** — `~/.copilot` and/or `~/.config/opencode` (symlink or copy)  
7. Optional **CodeGraph** — install CLI if needed, wire selected runtimes, `codegraph init` in each selected product repo (harness folder skipped)  
8. Optional **caveman pack** — install JuliusBrussee/caveman skill siblings into the harness (core chat skill already included)

Then:

- **Copilot:** open the generated `.code-workspace` in VS Code  
- **OpenCode:** `cd` to the **parent folder** and run `opencode`, then Tab to `sdlc-orchestrator`

Non-interactive example:

```bash
npx sdlc-copilot-harness --yes \
  --parent ~/dev \
  --agents-name "SDLC Harness" \
  --folders "SDLC Harness,Contoso.Api,Fabrikam.Web" \
  --workspace sdlc.code-workspace \
  --personal --personal-mode symlink \
  --opencode \
  --codegraph \
  --caveman
```

`--yes` without `--opencode` stays Copilot-only (backward compatible). Interactive install defaults to both runtimes.

### Uninstall

```bash
npx sdlc-copilot-harness uninstall
```

Removes the generated workspace file, parent `opencode.json` / `.opencode` (if this installer wrote them), `~/.copilot` and `~/.config/opencode` agents/skills this installer added, CodeGraph indexes it created (and Copilot/OpenCode wiring), and the copied harness folder. Product repos are never deleted. Non-interactive:

```bash
npx sdlc-copilot-harness uninstall --yes --parent ~/dev
```

### Update

```bash
npx sdlc-copilot-harness update
```

Checks the installed harness version against the package you are running (and npm `latest` when available). If outdated, refreshes agents/skills/docs/scripts in place (including generated OpenCode agents), re-applies `~/.copilot` / `~/.config/opencode` when personal install was used, and refreshes the caveman pack only if it was installed before. Workspace file and CodeGraph indexes are left alone. Non-interactive:

```bash
npx sdlc-copilot-harness update --yes --parent ~/dev
```

Until published to npm, run from this repo:

```bash
node bin/install.mjs
node bin/install.mjs uninstall
# or
npx --yes "/path/to/SDLC Harness"
```

### Manual setup

This repo lives as a **sibling** of product repos.

1. Copy [`templates/sdlc.code-workspace`](templates/sdlc.code-workspace) to the parent folder, or use the npx installer above.
2. Install prerequisites (see [docs/SETUP.md](docs/SETUP.md)):
   - Azure CLI + `azure-devops` extension
   - CodeGraph (use the installer’s **CodeGraph** option, or set up manually)
3. Optional: `./scripts/install-copilot-harness.sh` and/or `./scripts/install-opencode-harness.sh`
4. In Copilot Chat:
   - **Quality:** `sdlc-orchestrator`
   - **Economy (lower credits):** `sdlc-orchestrator-economy`
5. In OpenCode (from the parent folder):
   - Tab to **`sdlc-orchestrator`** or **`sdlc-orchestrator-economy`**
   - Specialists are subagents (`@analyst`, Task tool). Wait for the user between phases.

## Agents and models

Two profiles ship side by side. Copilot model fields use **slug IDs** (see [docs/MODEL-IDS.md](docs/MODEL-IDS.md)). Availability depends on your Copilot plan. OpenCode agents **omit** `model` so your connected provider (`/models`) applies.

### Standard (quality)

| Agent | Role | Model |
|-------|------|-----------------|
| `sdlc-orchestrator` | Route phases, enforce process | `gpt-5.6-terra` |
| `analyst` | Multi-repo analysis + docs | `gpt-5.6-sol` |
| `tech-pm` | Findings → short chat PRD (no file) | `claude-opus-4.8` |
| `ado-planner` | Chat PRD → next-slice Feature / Story / Task (asks for Epic first) | `claude-sonnet-5` |
| `ado-ops` | State moves, branch / PR linking | `gpt-5.6-luna` |
| `implementer` | Vertical-slice .NET 10 implementation | `gpt-5.3-codex` |
| `code-reviewer` | Review → ADO bugs (findings in descriptions) | `gpt-5.6-sol` |

Each agent file sets only that model (no fallback list).

### Economy (lower credits)

Same SDLC rules as standard — Epic gate, create backlog when missing, branching, caveman, CodeGraph — but cheaper models. Standard agents are **unchanged**.

| Agent | Role | Model |
|-------|------|-----------------|
| `sdlc-orchestrator-economy` | Route phases | `gpt-5.6-luna` |
| `analyst-economy` | Multi-repo analysis + docs | `gpt-5.6-terra` |
| `tech-pm-economy` | Findings → short chat PRD (no file) | `claude-sonnet-5` |
| `ado-planner-economy` | Chat PRD → next-slice Feature / Story / Task | `gpt-5.6-terra` |
| `ado-ops-economy` | States / branches / PR links | `gpt-5.6-luna` |
| `implementer-economy` | Vertical-slice implementation | `gpt-5.3-codex` |
| `code-reviewer-economy` | Review → ADO bugs (findings in descriptions) | `claude-sonnet-5` |

**How to use economy mode**

**Copilot**

1. Open the multi-root workspace.
2. In Copilot Chat, pick **`sdlc-orchestrator-economy`** (not `sdlc-orchestrator`).
3. Stay on `*-economy` handoffs for the whole flow — do not mix with standard Sol/Opus agents mid-run.

**OpenCode**

1. `cd` to the parent folder and run `opencode`.
2. Tab to **`sdlc-orchestrator-economy`**.
3. Stay on `*-economy` Task / `@` targets for the whole flow.

Escalate to standard agents only when you need full-quality analysis or review (large multi-repo ambiguity, security-critical review).

Economy defaults avoid: `gpt-5.6-sol`, `claude-opus-4.8`.

Details: [docs/ECONOMY.md](docs/ECONOMY.md).

## Layout

```
.github/
  copilot-instructions.md
  agents/           # Copilot *.agent.md personas + handoffs (source of truth)
  skills/           # on-demand SKILL.md packages (incl. caveman, CodeGraph, ADO)
  instructions/     # path-scoped Copilot instructions
.opencode/
  opencode.json     # default agent, instructions, skills (when CWD is the harness)
  agents/           # generated OpenCode *.md (do not hand-edit)
AGENTS.md           # OpenCode always-on rules
docs/               # SETUP, WORKFLOW, ADO-STATES, BRANCHING
scripts/            # install + az helpers
templates/          # PRD, analysis, review, workspace
```

After editing Copilot agents, regenerate OpenCode files:

```bash
node bin/sync-opencode-agents.mjs
```

## Hard rules (all agents)

1. Chat uses **caveman full** always (forced via always-on instructions + skill + every agent). Do not wait for `/caveman`. Persisted artifacts (analysis reports, ADO text, commits, PRs) use normal English. Do not write PRD or review markdown into the repo.
2. Prefer **CodeGraph** before blind grep/search.
3. Never create Features / User Stories / Tasks without a confirmed **Epic**. If no work items exist, **create the next slice** before branch/code. AC lives on the tickets; IDs in chat.
4. Branching: `main` → `feature/<slug>` → `feature/<slug>/<id>-name` → PR → feature branch.
5. Implementation follows **vertical feature slices** and clean C# practices.
6. After implementation: review → file ADO bugs (findings in descriptions) → fix with the same implementer loop.
7. All ADO mutations go through `az` CLI (or the scripts under `scripts/ado/`).

## Docs

- [SETUP.md](docs/SETUP.md) — install CodeGraph, az, Copilot workspace, OpenCode
- [PUBLISH.md](docs/PUBLISH.md) — publish package for `npx sdlc-copilot-harness`
- [ECONOMY.md](docs/ECONOMY.md) — credit-saving `*-economy` agents
- [MODEL-IDS.md](docs/MODEL-IDS.md) — Copilot slugs and OpenCode model notes
- [WORKFLOW.md](docs/WORKFLOW.md) — end-to-end SDLC phases
- [ADO-STATES.md](docs/ADO-STATES.md) — Agile state machine
- [BRANCHING.md](docs/BRANCHING.md) — branch and PR rules

## Attribution

- Core caveman chat skill adapted from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman); optional pack via installer `--caveman`
- CodeGraph: [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)
