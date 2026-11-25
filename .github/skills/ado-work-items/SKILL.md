---
name: ado-work-items
description: >
  Create and update Azure DevOps Agile work items with az CLI: Epic, Feature,
  User Story, Task, Bug. Always ask which Epic before creating Features/Stories/Tasks.
  Create the next slice only; return IDs in chat; never write a backlog summary.
  After real IDs exist, upsert the memory card (AB# and title only).
---

# Azure DevOps work items (`az`)

ADO is the source of truth. List created IDs **in chat**. Never write a backlog summary under `docs/prd/`, `docs/analysis/`, or `docs/reviews/`. After `az` returns real IDs, upsert the memory card ADO section (`AB#` and title only). Skill `cross-session-memory`. Status `backlog`.

## Output rule

Run only `scripts/ado/*.sh`. They print short lines (`EPIC_ID=`, `id= type= state= title=`, `PR_ID=`).
Do not run `az boards` or `az repos` with `-o json`, `-o table`, `work-item show`, or `boards query`.
Do not re-show an item you just created. Setup (`az login`, `az devops configure`) is the only raw `az` allowed.

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
3. If create-new: `./scripts/ado/create-hierarchy.sh --epic "Title" [--epic-desc "text"]`.
4. Only then create children.

## Mandatory create when missing (full mode)

If the user wants to build / branch / track work and **no** Feature / User Story / Task IDs exist, and the turn is **not** direct mode:

- Creating the **next slice** is **required** (full backlog only if the user asks)
- Do not stop at proposing titles in chat
- Run `./scripts/ado/create-hierarchy.sh` and return real IDs **in chat**
- `implementer` / `ado-ops` must wait for those IDs

Direct mode (`direct`, `skip analysis`, `no tickets`, `no ADO`, or naming one specialist) does not require this create step. The Epic gate above still applies when items are created.

## Hierarchy

`Epic` → `Feature` → `User Story` → `Task`

Default: create **the next slice only**. Other slices: title-only stubs on the Epic/Feature, or skip until asked.

Review bugs: `code-reviewer` creates `Bug` (or Task) under the relevant Feature / User Story.

## Create helpers

```bash
./scripts/ado/create-hierarchy.sh --epic "Title" --epic-desc "text"
./scripts/ado/create-hierarchy.sh --epic-id <ID> --feature "Title" --story "Title" --task "Title"
./scripts/ado/create-hierarchy.sh --parent-id <ID> --bug "Title" --bug-desc "text"
./scripts/ado/update-state.sh --id <ID> --state Active
```

Descriptions are arguments to the script. The script does not print them back. Parent links are applied inside `create-hierarchy.sh`.

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
./scripts/ado/show.sh --id <ID>
./scripts/ado/query.sh --parent <ID>
./scripts/ado/query.sh --parent <ID> --title "slice name"
```
