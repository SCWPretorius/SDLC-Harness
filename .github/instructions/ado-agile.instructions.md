---
applyTo: "**/*"
---

# Azure DevOps Agile process

Hierarchy: **Epic → Feature → User Story → Task**. Bugs created from review attach under the relevant Feature or User Story.

## Hard gate

Before creating any Feature, User Story, or Task: ask which Epic to use (existing ID or create new). Do not proceed until the user answers.

## Default states

- Feature / User Story: New → Active → Resolved → Closed
- Task / Bug: New → Active → Closed (Bugs may use Resolved when the process requires it — prefer project defaults if they differ)

Use `az boards` via skill `ado-work-items` and `docs/ADO-STATES.md`. Update states as agent work progresses (`ado-ops` agent).
