# Pull request review

Review Azure Repos pull requests from the terminal with `scripts/ado/pr-review.sh`.

Run it with the product repo as the current directory so Azure CLI can detect the remote and `git diff` can read the branches:

```bash
cd /path/to/product-repo
/path/to/harness/scripts/ado/pr-review.sh list
```

## Prerequisites

```bash
az login
az extension add --name azure-devops --upgrade
az devops configure --defaults organization=https://dev.azure.com/<ORG> project=<PROJECT>
```

Also needs `git` and `python3`. Override detection with `--org`, `--project`, `--repository`, or `--reviewer` (`--repository` and `--reviewer` apply to `list`).

## Commands

```bash
pr-review.sh list [--status active] [--all | --reviewer <id>]
pr-review.sh show --id <PR>
pr-review.sh diff --id <PR> [--full] [-- path]
pr-review.sh threads --id <PR>
pr-review.sh comment --id <PR> --text "..." [--file <path> --line <n>]
pr-review.sh vote --id <PR> approve|wait|reject|reset
```

`list` shows active pull requests where you are a reviewer (id, title, author, source → target, url) and prints that reviewer. `--reviewer` replaces the signed-in identity. `--all` drops the filter. The default identity is the signed-in user principal name, or `az account show` when that is unavailable.

`show` prints the summary, reviewers and votes, linked work items, description, and web URL.

`diff` fetches the source and target branches and prints `git diff --stat` plus the name-status for `target...source`. `--full` includes the patch. Pass a path to limit the diff. When the current repo is not the pull request repo, the command prints the full pull request file list (common commit through the latest iteration) and this line: the full patch needs a local clone.

`threads` prints review comments with author, status, and file and line when the thread is on a line. System comments are omitted.

`comment` posts a comment. `--file` and `--line` together put it on that line of the pull request side at the latest iteration. They must be used as a pair.

`vote` sets your vote. `wait` sends `wait-for-author`. `reset` clears your vote. There is no default, and nothing is posted or voted unless you run `comment` or `vote`.

See skill `ado-pr-review`.
