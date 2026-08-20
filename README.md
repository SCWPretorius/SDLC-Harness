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

| Agent | Role | Model |
|-------|------|-------|
| `sdlc-orchestrator` | Route phases, enforce process | GPT-5.6 Terra |
| `analyst` | Multi-repo analysis + docs | GPT-5.6 Sol |
| `tech-pm` | Findings → PRD | Claude Opus 4.8 |
| `ado-planner` | PRD → Features / Stories / Tasks (asks for Epic first) | Claude Sonnet 5 |
| `ado-ops` | State moves, branch / PR linking | GPT-5.6 Luna |
| `implementer` | Vertical-slice .NET 10 implementation | GPT-5.3-Codex |
| `code-reviewer` | Review + findings doc → ADO bugs | GPT-5.6 Sol |

Model IDs follow [GitHub Copilot model comparison](https://docs.github.com/en/copilot/reference/ai-models/model-comparison). Availability depends on your Copilot plan.

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

1. Chat uses **caveman** compression; persisted artifacts (PRD, tickets, commits, review docs) use normal English.
2. Prefer **CodeGraph** before blind grep/search.
3. Never create Features / User Stories / Tasks without a confirmed **Epic**.
4. Branching: `main` → `feature/<slug>` → `feature/<slug>/<id>-name` → PR → feature branch.
5. Implementation follows **vertical feature slices** and clean C# practices.
6. After implementation: review → document findings → create ADO items → fix with the same implementer loop.
7. All ADO mutations go through `az` CLI (or the scripts under `scripts/ado/`).

## Docs

- [SETUP.md](docs/SETUP.md) — install CodeGraph, az, workspace
- [WORKFLOW.md](docs/WORKFLOW.md) — end-to-end SDLC phases
- [ADO-STATES.md](docs/ADO-STATES.md) — Agile state machine
- [BRANCHING.md](docs/BRANCHING.md) — branch and PR rules

## Attribution

- Caveman skill vendored from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)
- CodeGraph: [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)
