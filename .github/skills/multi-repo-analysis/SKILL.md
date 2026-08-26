---
name: multi-repo-analysis
description: >
  Analyze requests across multiple sibling product repositories in a multi-root
  VS Code workspace. Produce concise cross-repo findings with repo citations.
---

# Multi-repo analysis

## Workspace assumption

Product repos sit as siblings; harness is another sibling. Open via multi-root `.code-workspace`.

## Procedure

1. List workspace folders (exclude harness unless the question is about the harness).
2. For each product repo: confirm CodeGraph index (`.codegraph/`) or init.
3. Restate the user request as analysis questions.
4. Per repo, use CodeGraph first; note relevant modules, contracts, ownership.
5. Identify cross-repo dependencies (HTTP/gRPC, shared packages, events, IaC).
6. Write one concise report using `templates/analysis-report.md`.
7. Save under `docs/analysis/<yyyy-mm-dd>-<slug>.md` in the harness (or agreed docs path).

## Report rules

- Concise. Prefer bullets over essays.
- Every claim cites `repo` + path/symbol when possible.
- Separate: facts found, gaps/unknowns, recommended next slices.
- Normal English (persisted artifact — no caveman).
- No code edits in analysis phase.

## Handoff

When analysis is complete, hand off to `tech-pm` to draft a **chat PRD** (no file).
