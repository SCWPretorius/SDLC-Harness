# SDLC Harness (GitHub Copilot / VS Code)

Standalone Azure DevOps–oriented agent harness for GitHub Copilot in VS Code. Ships custom agents, skills, and instructions for a full SDLC loop:

**Analysis → PRD → ADO work items → vertical-slice .NET implementation → code review → bug backlog → fix**

Not for Cursor. Stack: Azure DevOps (`az` CLI), C# .NET 10, Azure platform, Agile process (`Epic → Feature → User Story → Task`).

## Quick start

This repo lives at `dev/Agents` as a **sibling** of product repos.

1. Copy [`templates/sdlc.code-workspace`](templates/sdlc.code-workspace) to the parent folder:
   `dev/sdlc.code-workspace`
2. Replace mock `Product-*` folder entries with your real sibling repos, then open that file in VS Code (**File → Open Workspace from File…**).
3. Install prerequisites (see [docs/SETUP.md](docs/SETUP.md)):
   - Azure CLI + `azure-devops` extension
   - CodeGraph CLI wired for Copilot VS Code
   - `codegraph init` in **each** product repo
4. Optional personal install: `./scripts/install-copilot-harness.sh`
5. In Copilot Chat, pick **sdlc-orchestrator** (or a specialist agent) and describe the request.

## Agents and models

Model fields use **slug IDs** (see [docs/MODEL-IDS.md](docs/MODEL-IDS.md)).

| Agent | Role | Model (primary) |
|-------|------|-----------------|
| `sdlc-orchestrator` | Route phases, enforce process | `gpt-5.6-terra` |
| `analyst` | Multi-repo analysis + docs | `gpt-5.6-sol` |
| `tech-pm` | Findings → PRD | `claude-opus-4.8` |
| `ado-planner` | PRD → Features / Stories / Tasks (asks for Epic first) | `claude-sonnet-5` |
| `ado-ops` | State moves, branch / PR linking | `gpt-5.6-luna` |
| `implementer` | Vertical-slice .NET 10 implementation | `gpt-5.3-codex` |
| `code-reviewer` | Review + findings doc → ADO bugs | `gpt-5.6-sol` |

Availability depends on your Copilot plan. Fallbacks are listed in each agent file.

**Economy (lower credits):** use `sdlc-orchestrator-economy` and other `*-economy` agents — see [docs/ECONOMY.md](docs/ECONOMY.md). Standard agents above are unchanged.

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

- [ECONOMY.md](docs/ECONOMY.md) — credit-saving `*-economy` agents
- [MODEL-IDS.md](docs/MODEL-IDS.md) — Copilot model slug IDs for agent frontmatter
- [SETUP.md](docs/SETUP.md) — install CodeGraph, az, workspace
- [WORKFLOW.md](docs/WORKFLOW.md) — end-to-end SDLC phases
- [ADO-STATES.md](docs/ADO-STATES.md) — Agile state machine
- [BRANCHING.md](docs/BRANCHING.md) — branch and PR rules

## Attribution

- Caveman skill vendored from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)
- CodeGraph: [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)
