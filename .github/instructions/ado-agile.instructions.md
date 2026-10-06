---
applyTo: "**/*"
---

# Azure DevOps Agile process

Hierarchy: **Epic → Feature → User Story → Task**. Bugs created from review attach under the relevant Feature or User Story.

## Hard gate

Before creating any Feature, User Story, or Task: ask which Epic to use (existing ID or create new). Do not proceed until the user answers.

## Mandatory backlog (full mode)

If no work items exist for the current request, **create** them (Epic if needed → Feature → User Story → Task) via `ado-planner` / `az` before branching or coding. Do not proceed without real work item IDs.

Direct mode (`direct`, `skip analysis`, `no tickets`, `no ADO`, or naming one specialist) skips this. Epic selection above still applies whenever Features, User Stories, or Tasks are created.

## Default states

- Feature / User Story: New → Active → Resolved → Closed
- Task / Bug: New → Active → Closed (Bugs may use Resolved when the process requires it — prefer project defaults if they differ)

Use `az boards` via skill `ado-work-items` and `docs/ADO-STATES.md`. Update states as agent work progresses (`ado-ops` agent).
