---
name: ado-work-items
description: >
  Create and update Azure DevOps Agile work items with az CLI: Epic, Feature,
  User Story, Task, Bug. Always ask which Epic before creating Features/Stories/Tasks.
  Use for planning, backlog creation, hierarchy linking, and state updates.
---

# Azure DevOps work items (`az`)

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
3. Only then create children.

## Hierarchy

`Epic` → `Feature` → `User Story` → `Task`

Review bugs: create `Bug` (or Task) under the relevant Feature / User Story.

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
- Descriptions include acceptance criteria, repo touched, and PRD slice reference when available.

## Mapping from PRD

- Each vertical slice → one Feature (or Story if the slice is tiny).
- Stories stay thin and shippable.
- Tasks are concrete engineering steps (one branch-sized unit when possible).

## Query

```bash
az boards work-item show --id <ID> -o json
az boards query --wiql "SELECT [System.Id],[System.Title],[System.State] FROM WorkItems WHERE [System.Parent] = <ID>"
```
