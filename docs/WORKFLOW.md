# Workflow

End-to-end SDLC loop enforced by harness agents.

```text
Request
  → sdlc-orchestrator
  → analyst            (multi-repo analysis doc)
  → tech-pm            (short chat PRD — no file)
  → ado-planner        (ASK EPIC → next-slice Feature / Story / Task)
  → ado-ops            (states + branches)
  → implementer        (vertical slice on work-item branch)
  → code-reviewer      (ADO bugs; findings in descriptions)
  → implementer        (fix loop)
  → merge PR to feature branch
```

ADO is the source of truth for PRD slices, AC, and review findings. Do not write `docs/prd/` or `docs/reviews/`.

## Phase details

### 1. Analysis

Agent: `analyst`  
Skills: `codegraph-usage`, `multi-repo-analysis`  
Output: `docs/analysis/<date>-<slug>.md` from `templates/analysis-report.md`  
No product code edits.

### 2. PRD

Agent: `tech-pm`  
Skill: `prd-authoring`  
Output: short PRD **in chat** (problem, slices + AC, suggested Epic). No repo file.  
Human confirms before backlog.

### 3. Backlog

Agent: `ado-planner`  
**Must ask Epic first.**  
If no work items exist for the request, **creating the next slice is mandatory** (Epic if needed → Feature → Story → Task via `az` / `scripts/ado/create-hierarchy.sh`).  
Put AC on work-item descriptions. List IDs in chat. Do not write a summary file.  
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
- Chat PRD confirmation before backlog (recommended)
- Handoff buttons on the orchestrator use `send: false` so a human can start each phase

## Orchestrator behavior

`sdlc-orchestrator` is **router-only**: tools limited to the `agent` tool + fixed `agents:` list. It must invoke specialists (`analyst`, `tech-pm`, `ado-planner`, `ado-ops`, `implementer`, `code-reviewer`) and must not do their work. If it tries to analyze/code/create ADO items itself, stop it and pick the specialist (or re-run orchestrator with “invoke analyst now”).
