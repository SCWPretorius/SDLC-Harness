---
name: ado-work-items
description: >
  Create and update Azure DevOps Agile work items with az CLI: Epic, Feature,
  User Story, Task, Bug. Always ask which Epic before creating Features/Stories/Tasks.
  Create the next slice only; return IDs in chat; never write a summary file.
---

# Azure DevOps work items (`az`)

ADO is the source of truth. List created IDs **in chat**. Never write a backlog summary under `docs/prd/`, `docs/analysis/`, or anywhere else in the repo.

## Defaults

```bash
az login
az extension add --name azure-devops --upgrade
az devops configure --defaults organization=https://dev.azure.com/<ORG> project=<PROJECT>
```

Confirm org/project with the user if not already configured.

## Hard gate — Epic

Before creating Feature, User Story, or Task:

1. Ask: "Which Epic should these items live under? Provide Epic ID, or say create a new Epic."
2. Wait for answer.
3. If create-new: create the Epic with `az boards work-item create --type Epic ...` first.
4. Only then create children.

## Mandatory create when missing

If the user wants to build / branch / track work and **no** Feature / User Story / Task IDs exist:

- Creating the **next slice** is **required** (full backlog only if the user asks)
- Do not stop at proposing titles in chat
- Run `az` or `./scripts/ado/create-hierarchy.sh` and return real IDs **in chat**
- `implementer` / `ado-ops` must wait for those IDs

## Hierarchy

`Epic` → `Feature` → `User Story` → `Task`

Default: create **the next slice only**. Other slices: title-only stubs on the Epic/Feature, or skip until asked.

Review bugs: `code-reviewer` creates `Bug` (or Task) under the relevant Feature / User Story.

## Create helpers

Prefer repo scripts:

```bash
./scripts/ado/create-hierarchy.sh --epic-id <ID> --feature "Title" --story "Title" --task "Title"
./scripts/ado/update-state.sh --id <ID> --state Active
```

### Manual `az` examples

```bash
# Epic
az boards work-item create --type Epic --title "..." --description "..."

# Feature under Epic (parent link)
az boards work-item create --type Feature --title "..." --description "..." \
  --relation "parent=<EPIC_ID>"

# User Story under Feature
az boards work-item create --type "User Story" --title "..." --description "..." \
  --relation "parent=<FEATURE_ID>"

# Task under User Story
az boards work-item create --type Task --title "..." --description "..." \
  --relation "parent=<STORY_ID>"

# Bug under parent
az boards work-item create --type Bug --title "..." --description "..." \
  --relation "parent=<PARENT_ID>"
```

If `--relation parent=` fails on the installed CLI version, create the item then:

```bash
az boards work-item relation add --id <CHILD_ID> --relation-type parent --target-id <PARENT_ID>
```

## Titles and descriptions

- Normal English (not caveman).
- Titles concise and actionable.
- Descriptions are short: AC bullets, repo touched, slice name. No essay paste of the chat PRD.

## Mapping from PRD

- Next slice → one Feature (or Story if the slice is tiny) + branch-sized Task.
- Remaining slices: title-only stubs, or skip.
- Stories stay thin and shippable.

## Query

```bash
az boards work-item show --id <ID> -o json
az boards query --wiql "SELECT [System.Id],[System.Title],[System.State] FROM WorkItems WHERE [System.Parent] = <ID>"
```
