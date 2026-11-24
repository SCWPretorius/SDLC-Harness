---
name: ado-pr-review
description: >
  Review Azure DevOps pull requests from the terminal with
  scripts/ado/pr-review.sh: list, show, diff, threads, comment, and vote.
  Use when the user wants to review an Azure Repos PR with az.
---

# Azure Repos PR review

Human review from the terminal. Run the script with the **product repo as the working directory** so `az --detect` and `git diff` use that remote. Call the harness copy by path:

```bash
cd /path/to/product-repo
/path/to/harness/scripts/ado/pr-review.sh list
```

Organization and project come from `az devops configure --defaults`. Override with `--org`, `--project`, or `--repository` (list only).

Requires Azure CLI, the `azure-devops` extension, `git`, and `python3`.

## Commands

```bash
pr-review.sh list [--status active] [--all]
pr-review.sh show --id <PR>
pr-review.sh diff --id <PR> [--full] [-- path]
pr-review.sh threads --id <PR>
pr-review.sh comment --id <PR> --text "..." [--file <path> --line <n>]
pr-review.sh vote --id <PR> approve|wait|reject|reset
```

- **list** — active PRs where you are a reviewer. Identity is `az ad signed-in-user show` (user principal name), else `az account show`. `--all` lists every PR in the repo.
- **show** — title, author, branches, commits, status, merge status, reviewers and votes, linked work items, description, web URL.
- **diff** — `git diff --stat` and `--name-status` for `target...source`. `--full` adds the patch. A path limits it. Outside the PR repo, prints the changed-file list only.
- **threads** — review comments. System comments are skipped.
- **comment** — posts a thread. `--file` and `--line` together anchor it on that line of the PR side. Nothing is posted without this command.
- **vote** — `approve`, `wait` (`wait-for-author`), `reject`, or `reset` (clears your vote). No default.

`az repos pr` lists, shows, and votes. Diff fallback and comments use `az rest` on the Git pull-request API (api-version 7.1).

Details: `docs/PR-REVIEW.md`.
