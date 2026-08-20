# Workflow

End-to-end SDLC loop enforced by harness agents.

```text
Request
  → sdlc-orchestrator
  → analyst            (multi-repo analysis doc)
  → tech-pm            (PRD)
  → ado-planner        (ASK EPIC → Features / Stories / Tasks)
  → ado-ops            (states + branches)
  → implementer        (vertical slice on work-item branch)
  → code-reviewer      (findings doc)
  → ado-planner/ops    (bugs under parent)
  → implementer        (fix loop)
  → merge PR to feature branch
```

## Phase details

### 1. Analysis

Agent: `analyst`  
Skills: `codegraph-usage`, `multi-repo-analysis`  
Output: `docs/analysis/<date>-<slug>.md` from `templates/analysis-report.md`  
No product code edits.

### 2. PRD

Agent: `tech-pm`  
Skill: `prd-authoring`  
Output: `docs/prd/<date>-<slug>.md`  
Human confirms before backlog.

### 3. Backlog

Agent: `ado-planner`  
**Must ask Epic first.**  
If no work items exist for the request, **creating them is mandatory** (Epic if needed → Features → Stories → Tasks via `az` / `scripts/ado/create-hierarchy.sh`).  
Do not proceed to branch/implement without real ADO IDs.

### 4. Activate + branch

Agent: `ado-ops`  
States → Active; create `feature/<slug>` and work-item branches; link `AB#`.

### 5. Implement

Agent: `implementer`  
Vertical .NET 10 slice; clean code; CodeGraph; PR into **feature** branch.

### 6. Review + defects

Agent: `code-reviewer`  
Write full findings first, then create Bugs/Tasks, then fix with implementer using the same rules.

## Human gates

- Epic selection before any Feature/Story/Task create
- PRD confirmation before backlog (recommended)
- Handoff buttons on the orchestrator use `send: false` so a human can start each phase

## Orchestrator behavior

`sdlc-orchestrator` is **router-only**: tools limited to the `agent` tool + fixed `agents:` list. It must invoke specialists (`analyst`, `tech-pm`, `ado-planner`, `ado-ops`, `implementer`, `code-reviewer`) and must not do their work. If it tries to analyze/code/create ADO items itself, stop it and pick the specialist (or re-run orchestrator with “invoke analyst now”).