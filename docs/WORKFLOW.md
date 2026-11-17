# Workflow

End-to-end SDLC loop enforced by harness agents. **Full mode is the default.**

```text
Request
  → sdlc-orchestrator
  → analyst            (multi-repo analysis doc)
  → tech-pm            (short chat PRD — no docs/prd/)
  → ado-planner        (ASK EPIC → next-slice Feature / Story / Task)
  → ado-ops            (states + branches)
  → implementer        (vertical slice on work-item branch)
  → code-reviewer      (ADO bugs; findings in descriptions)
  → implementer        (fix loop)
  → merge PR to feature branch
```

ADO is the source of truth for PRD slices, AC, and review findings in full mode. Do not write `docs/prd/` or `docs/reviews/`.

A short memory card is the exception. After analysis, after the user confirms the chat PRD, and after real ADO ids exist, upsert one card under `memory/cards/` and one line in `memory/INDEX.md`. Skill: `cross-session-memory`. Do not copy the analysis, the acceptance criteria, or any Copilot session transcript.

## Direct mode

Say `direct`, `skip analysis`, `no tickets`, or `no ADO`, or name one specialist (`analyst`, `tech-pm`, `ado-planner`, `ado-ops`, `implementer`, `code-reviewer`, or the `*-economy` twin). The orchestrator invokes only that agent and stops.

- Missing analysis, chat PRD, or work item IDs is allowed.
- `implementer` codes on the current branch. A requested branch is `feature/<slug>` with no work-item segment and no AB# link.
- `code-reviewer` writes findings in chat. ADO bugs are filed when a parent ID exists or the user asks.
- Creating Features, User Stories, or Tasks still waits for a confirmed Epic.
- Phrases like “implement this” without an agent name stay on the full chain below.

## Invocation (Copilot vs OpenCode)

**Copilot:** orchestrator handoff buttons use `send: false` so a human starts each phase. Orchestrator invokes specialists with `#tool:agent`.

**OpenCode:** launch from the **parent folder**. Tab to `sdlc-orchestrator` (primary). Specialists are subagents — invoke with the **Task** tool or `@analyst`. After a specialist returns, **wait** before the next phase unless the user asked to continue. Economy: Tab to `sdlc-orchestrator-economy` and only Task `*-economy` specialists.

## Phase details (full mode)

### 1. Analysis

Agent: `analyst`  
Skills: `codegraph-usage`, `multi-repo-analysis`  
Output: `docs/analysis/<date>-<slug>.md` from `templates/analysis-report.md`  
Then upsert `memory/cards/<same-stem>.md` (Plan section only) and one `memory/INDEX.md` line. Status `analyzed`.  
No product code edits.

### 2. PRD

Agent: `tech-pm`  
Skill: `prd-authoring`  
Output: short PRD **in chat** (problem, slices + AC, suggested Epic). No `docs/prd/` file.  
Human confirms before backlog. After confirm, upsert the same memory card (PRD section only). Status `prd-confirmed`.

### 3. Backlog

Agent: `ado-planner`  
**Must ask Epic first.**  
If no work items exist for the request, **creating the next slice is mandatory** (Epic if needed → Feature → Story → Task via `az` / `scripts/ado/create-hierarchy.sh`).  
Put AC on work-item descriptions. List IDs in chat. Do not write a summary file.  
After real IDs exist, upsert the same memory card (ADO section: `AB#` and title only). Status `backlog`.  
Do not proceed to branch/implement without real ADO IDs.

### 4. Activate + branch

Agent: `ado-ops`  
States → Active; create `feature/<slug>` and work-item branches; link `AB#`.

### 5. Implement

Agent: `implementer`  
Vertical .NET 10 slice; clean code; CodeGraph; PR into **feature** branch.

### 6. Review + defects

Agent: `code-reviewer`  
File ADO Bugs/Tasks under the parent (descriptions hold findings). Chat: severity counts + AB# list. Then fix with implementer using the same rules.

## Human gates

- Epic selection before any Feature/Story/Task create
- Chat PRD confirmation before backlog (recommended) and before the PRD section of the memory card
- Handoff buttons on the Copilot orchestrator use `send: false` so a human can start each phase
- OpenCode has no handoff buttons: the orchestrator waits for the user (or an explicit “continue”) before the next Task

## Cross-session memory

`memory/INDEX.md` is one line per feature. Cards live in `memory/cards/`. Both are gitignored local files. Format: [memory/README.md](../memory/README.md).

A new session reads the index only when the request names another repo, a prior feature, or asks what was planned. It then opens one card, and the linked analysis only when the card is not enough. It does not read `.copilot` session transcripts.

## Orchestrator behavior

`sdlc-orchestrator` is **router-only**.

**Copilot:** tools limited to the `agent` tool + fixed `agents:` list. It must invoke specialists (`analyst`, `tech-pm`, `ado-planner`, `ado-ops`, `implementer`, `code-reviewer`) and must not do their work. If it tries to analyze/code/create ADO items itself, stop it and pick the specialist (or re-run orchestrator with “invoke analyst now”).

**OpenCode:** same rule via the Task tool / `@mention`. Permission.task allowlists only that profile’s specialists (standard cannot invoke `*-economy` and vice versa).
