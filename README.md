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
2. **Harness folder name** — default `Agents` (created/copied if missing)  
3. **Which sibling folders** to put in the multi-root workspace  
4. **Workspace file name** — default `sdlc.code-workspace` (written into the parent)  
5. Optional **~/.copilot** personal install (symlink or copy)

Then open the generated `.code-workspace` in VS Code.

Non-interactive example:

```bash
npx sdlc-copilot-harness --yes \
  --parent ~/dev \
  --agents-name Agents \
  --folders Agents,Contoso.Api,Fabrikam.Web \
  --workspace sdlc.code-workspace \
  --personal --personal-mode symlink
```

Until published to npm, run from this repo:

```bash
node bin/install.mjs
# or
npx --yes /path/to/Agents
```

### Manual setup

This repo lives as a **sibling** of product repos.

1. Copy [`templates/sdlc.code-workspace`](templates/sdlc.code-workspace) to the parent folder, or use the npx installer above.
2. Install prerequisites (see [docs/SETUP.md](docs/SETUP.md)):
   - Azure CLI + `azure-devops` extension
   - CodeGraph CLI wired for Copilot VS Code
   - `codegraph init` in **each** product repo
3. Optional: `./scripts/install-copilot-harness.sh`
4. In Copilot Chat, pick **sdlc-orchestrator** (or **sdlc-orchestrator-economy**) and describe the request.

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

- [SETUP.md](docs/SETUP.md) — install CodeGraph, az, workspace
- [PUBLISH.md](docs/PUBLISH.md) — publish package for `npx sdlc-copilot-harness`
- [ECONOMY.md](docs/ECONOMY.md) — credit-saving `*-economy` agents
- [MODEL-IDS.md](docs/MODEL-IDS.md) — Copilot model slug IDs for agent frontmatter
- [WORKFLOW.md](docs/WORKFLOW.md) — end-to-end SDLC phases
- [ADO-STATES.md](docs/ADO-STATES.md) — Agile state machine
- [BRANCHING.md](docs/BRANCHING.md) — branch and PR rules

## Attribution

- Caveman skill vendored from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)
- CodeGraph: [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)
