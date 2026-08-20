---
applyTo: "**/*"
---

# Branching strategy

Mandatory for all implementation and fix work:

1. `main` is protected integration line.
2. Long-lived (or epic-scoped) feature line: `feature/<feature-slug>`.
3. Work-item branch off the feature branch: `feature/<feature-slug>/<work-item-id>-short-name`.
4. Open PR from work-item branch **into the feature branch** (not into `main`).
5. Link branch and PR to the Azure DevOps work item (`AB#<id>` in PR description and/or development links).

Use skill `ado-branching` and scripts under `scripts/ado/` for linking. See `docs/BRANCHING.md`.
