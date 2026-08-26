---
name: code-review-findings
description: >
  File code review bugs and snags as Azure DevOps Bugs/Tasks under the relevant
  parent. Findings live in work-item descriptions, not a repo markdown file.
---

# Code review findings

ADO is the source of truth. **Do not write `docs/reviews/` or any findings markdown.**

## Process

1. Review the PR / diff for the active work item (correctness, security, tests, clean code, Azure concerns).
2. Create one ADO Bug or Task per finding under the relevant Feature / User Story. Use `templates/review-findings.md` as the **ADO description outline** (not a file to save).
3. Chat: severity counts + AB# list only.
4. Hand off to `implementer` / `ado-ops` to fix on work-item branches using the same branching rules.

File bugs yourself (`code-reviewer`). Do not hand off to `ado-planner` just to create tickets.

## Finding fields (in each ADO description)

- Severity: Blocker / High / Medium / Low
- Location: `repo` + path + symbol/line if known
- Problem
- Repro / evidence
- Suggested fix
- Parent work item ID
- PR URL

## Style

- Normal English.
- Specific and actionable. No vague "improve readability" without location + why.
- Security and data-loss issues are Blocker/High.

## ADO creation

Use skill `ado-work-items`. Titles like: `[Review] <short problem>`.
Description holds the full finding plus PR URL.
