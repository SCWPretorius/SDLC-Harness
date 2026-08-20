---
name: code-review-findings
description: >
  Document code review bugs and snags with severity, repro, and fix hints, then
  map them to Azure DevOps Bugs/Tasks under the relevant parent item.
---

# Code review findings

## Process

1. Review the PR / diff for the active work item (correctness, security, tests, clean code, Azure concerns).
2. Write **all** findings before creating ADO items — use `templates/review-findings.md`.
3. Save report under `docs/reviews/<yyyy-mm-dd>-<work-item-id>.md`.
4. After the findings doc is complete, create ADO Bugs (or Tasks) under the relevant Feature / User Story.
5. Hand off to `implementer` / `ado-ops` to fix on work-item branches using the same branching rules.

## Finding fields

For each item:

- ID (local F1, F2, …)
- Severity: Blocker / High / Medium / Low
- Location: `repo` + path + symbol/line if known
- Problem
- Repro / evidence
- Suggested fix
- Proposed ADO type (Bug vs Task)
- Parent work item ID

## Style

- Normal English.
- Specific and actionable. No vague "improve readability" without location + why.
- Security and data-loss issues are Blocker/High.

## ADO creation

Use skill `ado-work-items`. Titles like: `[Review] <short problem>`.
Description links to the findings doc section and PR URL.
