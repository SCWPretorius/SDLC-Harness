---
name: prd-authoring
description: >
  Convert analysis findings into a concise chat PRD with vertical slices and
  acceptance criteria. Do not write a repo file. Use after analysis, before ADO planning.
---

# PRD authoring

## Input

- User request
- Analysis report (`templates/analysis-report.md` output)

## Output

Draft a short PRD **in chat** from `templates/prd.md`. **Do not write `docs/prd/` or any PRD markdown into the repo.** Azure DevOps is the source of truth after confirm.

Keep it short:

- Problem / context (3–5 lines)
- Vertical slices with acceptance criteria checkboxes
- Suggested Epic (ID or create-new title)
- Repos touched (one line per slice)

Skip stakeholders, risks tables, and long non-goals unless the user asks.

## Style

- Normal English. Concise. No fluff.
- Slices map cleanly to Features later.
- Avoid implementation noise unless it constrains the design.
- Call out .NET 10 / Azure constraints when relevant.

## Gate for next phase

PRD must be reviewable by a human in chat before `ado-planner` creates work items. Ask user to confirm (or note explicit "proceed") before backlog creation. After confirm, pass slices + AC to `ado-planner` — AC lives on ADO work-item descriptions, not a file.
