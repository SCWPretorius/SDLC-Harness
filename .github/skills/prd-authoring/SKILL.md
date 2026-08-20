---
name: prd-authoring
description: >
  Convert analysis findings into a concise technical PRD with vertical slices,
  acceptance criteria, risks, and repos touched. Use after analysis, before ADO planning.
---

# PRD authoring

## Input

- User request
- Analysis report (`templates/analysis-report.md` output)

## Output

Create/update a PRD from `templates/prd.md`. Save as `docs/prd/<yyyy-mm-dd>-<slug>.md` (or path user specifies).

## Required sections

1. Problem / context
2. Goals and non-goals
3. Users / stakeholders (short)
4. Vertical slices (each slice independently valuable)
5. Acceptance criteria per slice
6. Repos and systems touched
7. Risks / open questions
8. Out of scope

## Style

- Normal English. Concise. No fluff.
- Slices map cleanly to Features later.
- Avoid implementation noise unless it constrains the design.
- Call out .NET 10 / Azure constraints when relevant.

## Gate for next phase

PRD must be reviewable by a human before `ado-planner` creates work items. Ask user to confirm PRD (or note explicit "proceed") before backlog creation.
