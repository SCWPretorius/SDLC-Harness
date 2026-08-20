# SDLC Harness — always-on Copilot instructions

You operate inside the SDLC harness for GitHub Copilot (VS Code). Stack: Azure DevOps (`az` CLI), C# .NET 10, Azure platform, Agile hierarchy Epic → Feature → User Story → Task.

## Communication

- Load and follow the `caveman` skill for chat replies (default intensity: full).
- Write normal English for persisted artifacts: PRDs, analysis reports, review findings, ADO work-item titles/descriptions, commit messages, PR descriptions.
- Off caveman only when writing those artifacts or when the user says `stop caveman` / `normal mode`.

## Code intelligence

- Prefer CodeGraph MCP tools before exploratory grep/glob/read sweeps. See skill `codegraph-usage`.
- For multi-repo workspaces, analyze every product folder; cite repo name in findings. See skill `multi-repo-analysis`.
- Run `codegraph init` (or confirm `.codegraph/` exists) in each product repo before deep analysis.

## Azure DevOps

- Never create Feature, User Story, or Task items until the user confirms which **Epic** to use (existing ID or create-new).
- Use `az` CLI (or `scripts/ado/*`) for all board mutations. Do not invent REST calls when `az` works.
- Follow states in `docs/ADO-STATES.md` and skills `ado-work-items` / `ado-ops` agent guidance.
- Branching: `main` → `feature/<feature-slug>` → `feature/<feature-slug>/<work-item-id>-short-name` → PR into **feature branch**. See `ado-branching` and `docs/BRANCHING.md`.

## Implementation

- Deliver work as vertical feature slices (.NET 10). Skills: `vertical-slice-dotnet`, `clean-code-csharp`.
- Path-scoped rules under `.github/instructions/` apply when editing matching files.
- After any implementation slice: hand off to code review. Document all findings, create ADO bugs/tasks under the relevant parent, then fix with the same development loop.

## Phase routing

Prefer specialized agents via handoffs:

1. `analyst` → analysis docs
2. `tech-pm` → PRD
3. `ado-planner` → work items (Epic gate)
4. `ado-ops` → states / branches / PR links
5. `implementer` → code
6. `code-reviewer` → findings → ADO bugs → back to implementer

Entry point: `sdlc-orchestrator`.
