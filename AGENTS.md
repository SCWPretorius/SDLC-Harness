# SDLC Harness — OpenCode

Always-on rules for [OpenCode](https://opencode.ai). Copilot uses `.github/copilot-instructions.md` instead.

Launch from the **parent folder** (the directory that holds this harness next to product repos), not from a single product git root. That is the OpenCode analog of the multi-root VS Code workspace.

```bash
cd /path/to/parent
opencode
```

Tab to **`sdlc-orchestrator`** (quality) or **`sdlc-orchestrator-economy`** (cheaper). Stay on that profile for the whole flow.

## Invocation

- Orchestrators are **primary** agents (Tab). Specialists are **subagents** (`@analyst`, Task tool).
- Orchestrator is a **router only**. It must invoke specialists; it must not analyze, write PRDs, mutate ADO, implement, or review itself.
- Human gates: after a specialist returns, **wait** before the next phase unless the user asked to continue.

Required chain for new work:

1. `analyst` → analysis docs
2. `tech-pm` → chat PRD (user confirms; no file)
3. `ado-planner` → next-slice work items (Epic gate; IDs in chat)
4. `ado-ops` → states / branches / PR links
5. `implementer` → code
6. `code-reviewer` → ADO bugs → back to `implementer`

Economy: Tab to `sdlc-orchestrator-economy` and only Task `*-economy` specialists. See `docs/ECONOMY.md`.

## Hard rules (same as Copilot)

Full text: `.github/copilot-instructions.md`. Path-scoped extras: `.github/instructions/`. Skills: load via the skill tool (`caveman`, `codegraph-usage`, `ado-work-items`, …).

1. Chat = **caveman full** every turn. Normal English only for persisted artifacts (analysis reports, ADO text, commits, PRs). Off only if user says `stop caveman` / `normal mode`.
2. Prefer **CodeGraph** before blind grep/search (`codegraph install --target=opencode`).
3. Never create Features / User Stories / Tasks without a confirmed **Epic**. If no work items exist, **create the next slice** before branch/code. AC lives on the tickets; IDs in chat.
4. Branching: `main` → `feature/<slug>` → `feature/<slug>/<id>-name` → PR → feature branch.
5. Implementation: vertical feature slices, clean C# / .NET 10.
6. After implementation: review → file ADO bugs (findings in descriptions) → fix with the same implementer loop.
7. All ADO mutations go through `az` CLI (or `scripts/ado/`).

Models: OpenCode agents do **not** pin Copilot slugs. Use `/models` (or `opencode.json` `model`) for your provider. Optional mapping: `docs/MODEL-IDS.md`.

Workflow detail: `docs/WORKFLOW.md`.
