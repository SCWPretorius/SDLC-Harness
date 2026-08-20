---
name: ado-branching
description: >
  Azure DevOps Git branching: main to feature branch to work-item branch to PR
  back to feature. Link branches and PRs to work items. Use when starting work,
  opening PRs, or wiring AB# links.
---

# Branching strategy

```
main
  └── feature/<feature-slug>
        └── feature/<feature-slug>/<work-item-id>-short-name
              └── PR ──► feature/<feature-slug>
```

Never open implementation PRs directly to `main` unless the user explicitly overrides.

## Naming

- `feature-slug`: lowercase kebab-case from Feature title (max ~40 chars).
- `short-name`: lowercase kebab-case summary of the work item.
- Example: `feature/payments-capture/12345-authorize-endpoint`

## Create branches

```bash
git fetch origin
git checkout main
git pull --ff-only

# Feature branch (once per Feature)
git checkout -b feature/<feature-slug>
git push -u origin HEAD

# Work-item branch off feature
git checkout feature/<feature-slug>
git pull --ff-only
git checkout -b feature/<feature-slug>/<work-item-id>-short-name
git push -u origin HEAD
```

Use `./scripts/ado/link-branch.sh` after push when possible.

## Pull requests

- Source: work-item branch
- Target: `feature/<feature-slug>`
- Description must include `AB#<work-item-id>`
- Title: short summary matching the work item

Azure Repos example:

```bash
az repos pr create \
  --source-branch feature/<feature-slug>/<work-item-id>-short-name \
  --target-branch feature/<feature-slug> \
  --title "..." \
  --description "AB#<work-item-id>\n\n..."
```

## Link development

Prefer:

```bash
./scripts/ado/link-branch.sh --id <WORK_ITEM_ID> --branch feature/<feature-slug>/<id>-name
```

Also keep `AB#` in commits/PR body so ADO auto-links when configured.

## Agent duties

1. Ensure feature branch exists before work-item branch.
2. Set work item Active when coding starts (`ado-ops` / `update-state.sh`).
3. After PR opened, document PR URL on the work item discussion or description.
