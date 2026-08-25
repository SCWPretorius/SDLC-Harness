# SDLC Harness (GitHub Copilot / VS Code)

Standalone Azure DevOps–oriented agent harness for GitHub Copilot in VS Code. Ships custom agents, skills, and instructions for a full SDLC loop:

**Analysis → PRD → ADO work items → vertical-slice .NET implementation → code review → bug backlog → fix**

Not for Cursor. Stack: Azure DevOps (`az` CLI), C# .NET 10, Azure platform, Agile process (`Epic → Feature → User Story → Task`).

## Quick start

### Install with npx (recommended)

From any machine with Node 18+:

```bash
npx sdlc-copilot-harness
```

The installer asks for:

1. **Parent folder** — directory that holds sibling product repos  
2. **Harness folder name** — default `SDLC Harness` (created/copied if missing)  
3. **Which sibling folders** to put in the multi-root workspace  
4. **Workspace file name** — default `sdlc.code-workspace` (written into the parent)  
5. Optional **~/.copilot** personal install (symlink or copy)  
6. Optional **CodeGraph** — install CLI if needed, wire Copilot VS Code, `codegraph init` in each selected product repo (harness folder skipped)  
7. Optional **caveman pack** — install JuliusBrussee/caveman skill siblings into the harness (core chat skill already included)

Then open the generated `.code-workspace` in VS Code.

Non-interactive example:

```bash
npx sdlc-copilot-harness --yes \
  --parent ~/dev \
  --agents-name "SDLC Harness" \
  --folders "SDLC Harness,Contoso.Api,Fabrikam.Web" \
  --workspace sdlc.code-workspace \
  --personal --personal-mode symlink \
  --codegraph \
  --caveman
```

### Uninstall

```bash
npx sdlc-copilot-harness uninstall
```

Removes the generated workspace file, `~/.copilot` agents/skills this installer added, CodeGraph indexes it created (and Copilot wiring), and the copied harness folder. Product repos are never deleted. Non-interactive:

```bash
npx sdlc-copilot-harness uninstall --yes --parent ~/dev
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
3. Optional: `./scripts/install-copilot-harness.sh`
4. In Copilot Chat:
   - **Quality:** `sdlc-orchestrator`
   - **Economy (lower credits):** `sdlc-orchestrator-economy`

## Agents and models

Two profiles ship side by side. Model fields use **slug IDs** (see [docs/MODEL-IDS.md](docs/MODEL-IDS.md)). Availability depends on your Copilot plan.

### Standard (quality)

| Agent | Role | Model (primary) |
|-------|------|-----------------|
| `sdlc-orchestrator` | Route phases, enforce process | `gpt-5.6-terra` |
| `analyst` | Multi-repo analysis + docs | `gpt-5.6-sol` |
| `tech-pm` | Findings → PRD | `claude-opus-4.8` |
| `ado-planner` | PRD → Features / Stories / Tasks (asks for Epic first) | `claude-sonnet-5` |
| `ado-ops` | State moves, branch / PR linking | `gpt-5.6-luna` |
| `implementer` | Vertical-slice .NET 10 implementation | `gpt-5.3-codex` |
| `code-reviewer` | Review + findings doc → ADO bugs | `gpt-5.6-sol` |

Fallbacks (including Sol/Opus/Fable where listed) are in each agent file.

### Economy (lower credits)

Same SDLC rules as standard — Epic gate, create backlog when missing, branching, caveman, CodeGraph — but cheaper models. Standard agents are **unchanged**.

| Agent | Role | Model (primary) |
|-------|------|-----------------|
| `sdlc-orchestrator-economy` | Route phases | `gpt-5.6-luna` |
| `analyst-economy` | Multi-repo analysis + docs | `gpt-5.6-terra` |
| `tech-pm-economy` | Findings → PRD | `claude-sonnet-5` |
| `ado-planner-economy` | PRD → Features / Stories / Tasks | `gpt-5.6-terra` |
| `ado-ops-economy` | States / branches / PR links | `gpt-5.6-luna` |
| `implementer-economy` | Vertical-slice implementation | `gpt-5.3-codex` |
| `code-reviewer-economy` | Review + findings → ADO bugs | `claude-sonnet-5` |

**How to use economy mode**

1. Open the multi-root workspace.
2. In Copilot Chat, pick **`sdlc-orchestrator-economy`** (not `sdlc-orchestrator`).
3. Stay on `*-economy` handoffs for the whole flow — do not mix with standard Sol/Opus agents mid-run.

Escalate to standard agents only when you need full-quality analysis or review (large multi-repo ambiguity, security-critical review).

Economy defaults avoid: `gpt-5.6-sol`, `gpt-5.5`, `claude-opus-4.8`, `claude-fable-5`.

Details: [docs/ECONOMY.md](docs/ECONOMY.md).

## Layout

```
.github/
  copilot-instructions.md
  agents/           # *.agent.md personas + handoffs
  skills/           # on-demand SKILL.md packages (incl. caveman, CodeGraph, ADO)
  instructions/     # path-scoped Copilot instructions
docs/               # SETUP, WORKFLOW, ADO-STATES, BRANCHING
scripts/            # install + az helpers
templates/          # PRD, analysis, review, workspace
```

## Hard rules (all agents)

1. Chat uses **caveman full** always (forced via always-on instructions + skill + every agent). Do not wait for `/caveman`. Persisted artifacts (PRD, tickets, commits, review docs) use normal English.
2. Prefer **CodeGraph** before blind grep/search.
3. Never create Features / User Stories / Tasks without a confirmed **Epic**. If no work items exist, **create** them before branch/code.
4. Branching: `main` → `feature/<slug>` → `feature/<slug>/<id>-name` → PR → feature branch.
5. Implementation follows **vertical feature slices** and clean C# practices.
6. After implementation: review → document findings → create ADO items → fix with the same implementer loop.
7. All ADO mutations go through `az` CLI (or the scripts under `scripts/ado/`).

## Docs

- [SETUP.md](docs/SETUP.md) — install CodeGraph, az, workspace
- [PUBLISH.md](docs/PUBLISH.md) — publish package for `npx sdlc-copilot-harness`
- [ECONOMY.md](docs/ECONOMY.md) — credit-saving `*-economy` agents
- [MODEL-IDS.md](docs/MODEL-IDS.md) — Copilot model slug IDs for agent frontmatter
- [WORKFLOW.md](docs/WORKFLOW.md) — end-to-end SDLC phases
- [ADO-STATES.md](docs/ADO-STATES.md) — Agile state machine
- [BRANCHING.md](docs/BRANCHING.md) — branch and PR rules

## Attribution

- Core caveman chat skill adapted from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman); optional pack via installer `--caveman`
- CodeGraph: [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)
