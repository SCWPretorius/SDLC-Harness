#!/usr/bin/env bash
# Review Azure Repos pull requests from the terminal.
set -euo pipefail

ADO_RESOURCE="499b84ac-1321-427f-aa17-267ca6975798"

CMD=""
ORG=""
PROJECT=""
REPOSITORY=""
REVIEWER=""
ID=""
STATUS="active"
ALL=0
FULL=0
TEXT=""
FILE=""
LINE=""
VOTE=""
HELP=0
STATUS_SET=0
CONFIG_ORG=""
CONFIG_PROJECT=""
TMP=""
PATH_FILTER=()

usage_general() {
  cat <<'EOF'
Usage:
  pr-review.sh <command> [options]

Commands:
  list      Active pull requests where you are a reviewer
  show      Summary, reviewers, work items, description
  diff      Branch diff (--stat and name-status; --full for the patch)
  threads   Review comments
  comment   Post a comment (optionally on a file line)
  vote      approve, wait, reject, or reset

Run this from the product repo so az can detect the remote and git diff
can see the branches. Organization and project come from
`az devops configure --defaults` unless overridden.

Options:
  --org <url-or-name>   Azure DevOps organization
  --project <name>      Project (list, and REST calls)
  --repository <name>   Repository (list)
  --reviewer <id>       Reviewer email or id (list)
  -h, --help            Command help

Examples:
  pr-review.sh list
  pr-review.sh show --id 1204
  pr-review.sh diff --id 1204 --full
  pr-review.sh comment --id 1204 --text "Please add a test."
  pr-review.sh vote --id 1204 wait
EOF
}

usage_cmd() {
  case "$1" in
    list)
      cat <<'EOF'
Usage:
  pr-review.sh list [--status active] [--all | --reviewer <id>]
                    [--org <org>] [--project <name>] [--repository <name>]

Lists pull requests in the detected repository. Default status is active.
Default reviewer is you (`az ad signed-in-user show`, else `az account show`).
The chosen reviewer is printed. --reviewer replaces that identity.
--all drops the reviewer filter.
EOF
      ;;
    show)
      cat <<'EOF'
Usage:
  pr-review.sh show --id <PR> [--org <org>]

Prints title, author, branches, commits, status, merge status, reviewers
and votes, linked work items, description, and the web URL.
EOF
      ;;
    diff)
      cat <<'EOF'
Usage:
  pr-review.sh diff --id <PR> [--full] [-- <path>...]
                    [--org <org>] [--project <name>]

Fetches the source and target branches and prints `git diff --stat` plus
`--name-status` for target...source. --full also prints the patch. A path
limits the diff.

Outside that repository, prints the full pull request file list (common
commit through the latest iteration). The patch needs a local clone.
EOF
      ;;
    threads)
      cat <<'EOF'
Usage:
  pr-review.sh threads --id <PR> [--org <org>] [--project <name>]

Prints review threads (author, status, file and line, comment text).
System comments are skipped.
EOF
      ;;
    comment)
      cat <<'EOF'
Usage:
  pr-review.sh comment --id <PR> --text <text> [--file <path> --line <n>]
                       [--org <org>] [--project <name>]

Posts a pull request comment. --file and --line together attach it to that
line on the PR side (right file) at the latest iteration. They must be
passed as a pair.
EOF
      ;;
    vote)
      cat <<'EOF'
Usage:
  pr-review.sh vote --id <PR> approve|wait|reject|reset [--org <org>]

Sets your vote. wait sends wait-for-author. reset clears your vote.
There is no default vote.
EOF
      ;;
    *)
      usage_general
      ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    list|show|diff|threads|comment|vote)
      if [[ -n "$CMD" ]]; then
        echo "ERROR: only one command is allowed." >&2
        exit 1
      fi
      CMD="$1"
      shift
      ;;
    --org)
      ORG="${2:-}"
      shift 2
      ;;
    --project)
      PROJECT="${2:-}"
      shift 2
      ;;
    --repository)
      REPOSITORY="${2:-}"
      shift 2
      ;;
    --reviewer)
      REVIEWER="${2:-}"
      shift 2
      ;;
    --id)
      ID="${2:-}"
      shift 2
      ;;
    --status)
      STATUS="${2:-}"
      STATUS_SET=1
      shift 2
      ;;
    --all)
      ALL=1
      shift
      ;;
    --full)
      FULL=1
      shift
      ;;
    --text)
      TEXT="${2:-}"
      shift 2
      ;;
    --file)
      FILE="${2:-}"
      shift 2
      ;;
    --line)
      LINE="${2:-}"
      shift 2
      ;;
    --)
      shift
      if [[ "$CMD" != "diff" ]]; then
        echo "ERROR: paths are only valid with diff." >&2
        exit 1
      fi
      if [[ $# -gt 0 ]]; then
        PATH_FILTER+=("$@")
      fi
      break
      ;;
    -h|--help)
      HELP=1
      shift
      ;;
    *)
      if [[ "$CMD" == "vote" && -z "$VOTE" && "$1" != -* ]]; then
        VOTE="$1"
        shift
      elif [[ "$CMD" == "diff" && "$1" != -* ]]; then
        PATH_FILTER+=("$1")
        shift
      else
        echo "ERROR: unknown arg: $1" >&2
        usage_general >&2
        exit 1
      fi
      ;;
  esac
done

if [[ "$HELP" -eq 1 ]]; then
  if [[ -n "$CMD" ]]; then
    usage_cmd "$CMD"
  else
    usage_general
  fi
  exit 0
fi

if [[ -z "$CMD" ]]; then
  usage_general >&2
  exit 1
fi

reject_flag() {
  echo "ERROR: $1 is only valid with $2." >&2
  exit 1
}

if [[ "$CMD" != "list" && "$STATUS_SET" -eq 1 ]]; then
  reject_flag "--status" "list"
fi
if [[ "$CMD" != "list" && "$ALL" -eq 1 ]]; then
  reject_flag "--all" "list"
fi
if [[ "$CMD" != "list" && -n "$REVIEWER" ]]; then
  reject_flag "--reviewer" "list"
fi
if [[ "$ALL" -eq 1 && -n "$REVIEWER" ]]; then
  echo "ERROR: --all and --reviewer cannot be used together." >&2
  exit 1
fi
if [[ "$CMD" != "diff" && "$FULL" -eq 1 ]]; then
  reject_flag "--full" "diff"
fi
if [[ "$CMD" != "diff" && ${#PATH_FILTER[@]} -gt 0 ]]; then
  reject_flag "a path" "diff"
fi
if [[ "$CMD" != "comment" && -n "$TEXT" ]]; then
  reject_flag "--text" "comment"
fi
if [[ "$CMD" != "comment" && ( -n "$FILE" || -n "$LINE" ) ]]; then
  reject_flag "--file/--line" "comment"
fi
if [[ "$CMD" != "vote" && -n "$VOTE" ]]; then
  reject_flag "a vote" "vote"
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI not found." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found." >&2
  exit 1
fi

require_id() {
  if [[ -z "$ID" ]]; then
    echo "ERROR: --id is required." >&2
    usage_cmd "$CMD" >&2
    exit 1
  fi
  if ! [[ "$ID" =~ ^[0-9]+$ ]]; then
    echo "ERROR: --id must be a pull request number." >&2
    exit 1
  fi
}

ensure_tmp() {
  if [[ -z "$TMP" ]]; then
    TMP=$(mktemp -d "${TMPDIR:-/tmp}/pr-review.XXXXXX")
    trap 'rm -rf "$TMP"' EXIT
  fi
}

load_defaults() {
  local out
  out=$(az devops configure --list 2>/dev/null || true)
  CONFIG_ORG=$(printf '%s\n' "$out" | awk -F= '/^[[:space:]]*organization[[:space:]]*=/{sub(/^[^=]*=[[:space:]]*/,""); print; exit}')
  CONFIG_PROJECT=$(printf '%s\n' "$out" | awk -F= '/^[[:space:]]*project[[:space:]]*=/{sub(/^[^=]*=[[:space:]]*/,""); print; exit}')
}

py() {
  PR_ORG="$ORG" \
  PR_PROJECT="$PROJECT" \
  PR_CONFIG_ORG="$CONFIG_ORG" \
  PR_CONFIG_PROJECT="$CONFIG_PROJECT" \
  PR_TEXT="$TEXT" \
  PR_FILE="$FILE" \
  PR_LINE="$LINE" \
  PR_ITERATION="${PR_ITERATION:-}" \
  python3 - "$@" <<'PY'
import json
import os
import re
import sys
import urllib.parse

op = sys.argv[1]
args = sys.argv[2:]


def die(msg):
    sys.stderr.write("ERROR: %s\n" % msg)
    raise SystemExit(1)


def load(path):
    with open(path, "r") as handle:
        return json.load(handle)


def one_line(value):
    return " ".join(str(value or "").split())


def branch_name(ref):
    ref = ref or ""
    prefix = "refs/heads/"
    if ref.startswith(prefix):
        return ref[len(prefix):]
    return ref


def vote_label(vote):
    try:
        vote = int(vote)
    except (TypeError, ValueError):
        return "unknown"
    labels = {
        10: "approved",
        5: "approved with suggestions",
        0: "no vote",
        -5: "waiting for author",
        -10: "rejected",
    }
    return labels.get(vote, "vote %s" % vote)


def thread_status(value):
    labels = {
        0: "unknown",
        1: "active",
        2: "fixed",
        3: "wontFix",
        4: "closed",
        5: "byDesign",
        6: "pending",
    }
    if isinstance(value, int):
        return labels.get(value, str(value))
    text = str(value or "unknown")
    if text.isdigit():
        return labels.get(int(text), text)
    return text


def is_system(comment):
    kind = comment.get("commentType")
    if isinstance(kind, int):
        return kind == 3
    return str(kind or "").lower() == "system"


def web_url(pr):
    links = pr.get("_links") or {}
    web = links.get("web") or {}
    href = web.get("href") or ""
    if href:
        return href
    remote = (pr.get("repository") or {}).get("remoteUrl") or ""
    pull_id = pr.get("pullRequestId")
    if remote and pull_id:
        return remote.rstrip("/") + "/pullrequest/" + str(pull_id)
    return ""


def author_name(person):
    person = person or {}
    return one_line(person.get("displayName") or person.get("uniqueName") or "unknown")


def azure_parts(url):
    if not url:
        return None
    text = url.strip().rstrip("/")
    match = re.search(
        r"ssh\.dev\.azure\.com[:/]v3/([^/]+)/([^/]+)/([^/]+)$",
        text,
        re.I,
    )
    if match:
        return tuple(urllib.parse.unquote(part) for part in match.groups())
    match = re.search(
        r"dev\.azure\.com/([^/]+)/([^/]+)/_git/([^/?#]+)",
        text,
        re.I,
    )
    if match:
        return tuple(urllib.parse.unquote(part) for part in match.groups())
    match = re.search(
        r"vs-ssh\.visualstudio\.com[:/]v3/([^/]+)/([^/]+)/([^/]+)$",
        text,
        re.I,
    )
    if match:
        return tuple(urllib.parse.unquote(part) for part in match.groups())
    match = re.search(
        r"https://(?:[^@/]+@)?([^./]+)\.visualstudio\.com/(?:DefaultCollection/)?([^/]+)/_git/([^/?#]+)",
        text,
        re.I,
    )
    if match:
        return tuple(urllib.parse.unquote(part) for part in match.groups())
    return None


def repo_key(url):
    parts = azure_parts(url)
    if parts:
        return "/".join(part.lower() for part in parts)
    text = (url or "").strip().rstrip("/")
    if text.startswith("/"):
        return os.path.normpath(text).lower()
    return text.lower()


def org_from_remote(url):
    parts = azure_parts(url)
    if not parts:
        return ""
    return "https://dev.azure.com/" + parts[0]


def normalize_org(org):
    org = (org or "").strip().rstrip("/")
    if not org:
        return ""
    if org.startswith("http://") or org.startswith("https://"):
        return org
    return "https://dev.azure.com/" + org.strip("/")


def api_url(pr, suffix):
    repo = pr.get("repository") or {}
    org = (
        normalize_org(os.environ.get("PR_ORG", ""))
        or org_from_remote(repo.get("remoteUrl") or "")
        or normalize_org(os.environ.get("PR_CONFIG_ORG", ""))
    )
    project = (
        os.environ.get("PR_PROJECT", "")
        or (repo.get("project") or {}).get("name")
        or os.environ.get("PR_CONFIG_PROJECT", "")
    )
    repo_id = repo.get("id") or ""
    pull_id = pr.get("pullRequestId")
    if not org or not project or not repo_id or not pull_id:
        die(
            "Need organization, project, and repository id. "
            "Set az devops defaults or pass --org and --project."
        )
    return "%s/%s/_apis/git/repositories/%s/pullRequests/%s/%s" % (
        org,
        urllib.parse.quote(str(project), safe=""),
        urllib.parse.quote(str(repo_id), safe=""),
        pull_id,
        suffix,
    )


def as_list(data, *keys):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in keys:
            value = data.get(key)
            if isinstance(value, list):
                return value
    return []


def work_item_ids(data):
    found = []
    for item in as_list(data, "value", "workItems"):
        if isinstance(item, dict):
            item_id = item.get("id")
            if item_id is None:
                item_id = item.get("workItemId")
            text = str(item_id or "").strip()
        else:
            text = str(item).strip()
        if text:
            found.append(text)
    return found


def path_matches(path, filters):
    if not filters:
        return True
    normalized = (path or "").lstrip("/")
    for item in filters:
        wanted = item.lstrip("/")
        if not wanted:
            continue
        if (
            normalized == wanted
            or normalized.endswith("/" + wanted)
            or normalized.startswith(wanted + "/")
        ):
            return True
    return False


if op == "format-list":
    rows = []
    for pr in as_list(load(args[0]), "value"):
        source = branch_name(pr.get("sourceRefName"))
        target = branch_name(pr.get("targetRefName"))
        rows.append((
            str(pr.get("pullRequestId") or ""),
            one_line(pr.get("title") or "(untitled)"),
            author_name(pr.get("createdBy")),
            "%s → %s" % (source, target),
            web_url(pr),
        ))
    if not rows:
        print("No pull requests.")
        raise SystemExit(0)
    headers = ("ID", "TITLE", "AUTHOR", "BRANCHES", "URL")
    widths = [len(header) for header in headers]
    for row in rows:
        for index, column in enumerate(row):
            widths[index] = max(widths[index], len(column))
    def emit(row):
        parts = []
        for index, column in enumerate(row):
            if index == len(row) - 1:
                parts.append(column)
            else:
                parts.append(column.ljust(widths[index]))
        print("  ".join(parts))
    emit(headers)
    for row in rows:
        emit(row)
elif op == "format-show":
    pr = load(args[0])
    items = work_item_ids(load(args[1]))
    source = branch_name(pr.get("sourceRefName"))
    target = branch_name(pr.get("targetRefName"))
    source_commit = ((pr.get("lastMergeSourceCommit") or {}).get("commitId") or "")[:12]
    target_commit = ((pr.get("lastMergeTargetCommit") or {}).get("commitId") or "")[:12]
    print("PR %s: %s" % (pr.get("pullRequestId") or "", one_line(pr.get("title") or "(untitled)")))
    print("URL: %s" % (web_url(pr) or "(unknown)"))
    print("Author: %s" % author_name(pr.get("createdBy")))
    print("Status: %s" % (pr.get("status") or ""))
    print("Merge: %s" % (pr.get("mergeStatus") or ""))
    print("Branches: %s → %s" % (source, target))
    if source_commit or target_commit:
        print("Commits: %s → %s" % (source_commit, target_commit))
    print("Reviewers:")
    reviewers = pr.get("reviewers") or []
    if not reviewers:
        print("  (none)")
    else:
        for reviewer in reviewers:
            print("  %s — %s" % (author_name(reviewer), vote_label(reviewer.get("vote"))))
    print("Work items:")
    if not items:
        print("  (none)")
    else:
        for item_id in items:
            print("  %s" % item_id)
    print("Description:")
    description = (pr.get("description") or "").rstrip()
    if description.strip():
        print(description)
    else:
        print("(none)")
elif op == "repo-match":
    pr = load(args[0])
    remote = (pr.get("repository") or {}).get("remoteUrl") or ""
    left = repo_key(remote)
    right = repo_key(args[1])
    if left and right and left == right:
        print("yes")
    else:
        print("no")
elif op == "diff-refs":
    pr = load(args[0])
    source_ref = pr.get("sourceRefName") or ""
    target_ref = pr.get("targetRefName") or ""
    if not source_ref or not target_ref:
        die("Pull request is missing source or target branch.")
    print(source_ref)
    print(target_ref)
    print(branch_name(source_ref))
    print(branch_name(target_ref))
elif op == "threads-url":
    print(api_url(load(args[0]), "threads?api-version=7.1"))
elif op == "iterations-url":
    print(api_url(load(args[0]), "iterations?api-version=7.1"))
elif op == "changes-url":
    print(api_url(load(args[0]), "iterations/%s/changes?$compareTo=0&$top=2000&api-version=7.1" % args[1]))
elif op == "iteration-id":
    best = None
    for item in as_list(load(args[0]), "value"):
        if not isinstance(item, dict) or item.get("id") is None:
            continue
        current = int(item["id"])
        if best is None or current > best:
            best = current
    if best is not None:
        print(best)
elif op == "format-threads":
    printed = 0
    for thread in as_list(load(args[0]), "value"):
        if not isinstance(thread, dict):
            continue
        visible = []
        for comment in thread.get("comments") or []:
            if not isinstance(comment, dict) or is_system(comment):
                continue
            content = (comment.get("content") or "").rstrip()
            if not content.strip():
                continue
            visible.append((author_name(comment.get("author")), content))
        if not visible:
            continue
        if printed:
            print("")
        context = thread.get("threadContext") or {}
        path = context.get("filePath") or ""
        start = context.get("rightFileStart") or context.get("leftFileStart") or {}
        line = start.get("line")
        location = path
        if path and line:
            location = "%s:%s" % (path, line)
        header = "Thread %s  %s" % (thread.get("id") or "?", thread_status(thread.get("status")))
        if location:
            header = "%s  %s" % (header, location)
        print(header)
        for name, content in visible:
            print("  %s:" % name)
            for content_line in content.splitlines():
                print("    %s" % content_line)
        printed += 1
    if not printed:
        print("No comment threads.")
elif op == "format-changes":
    filters = args[1:]
    printed = 0
    for entry in as_list(load(args[0]), "changeEntries", "changes"):
        if not isinstance(entry, dict):
            continue
        item = entry.get("item") or {}
        path = item.get("path") or entry.get("path") or ""
        if not path_matches(path, filters):
            continue
        change = entry.get("changeType") or "change"
        if not isinstance(change, str):
            change = str(change)
        print("%s\t%s" % (change, path))
        printed += 1
    if not printed:
        print("No file changes.")
elif op == "comment-body":
    content = os.environ.get("PR_TEXT", "")
    if not content.strip():
        die("--text is required.")
    body = {
        "comments": [
            {
                "parentCommentId": 0,
                "content": content,
                "commentType": 1,
            }
        ],
        "status": 1,
    }
    path = os.environ.get("PR_FILE", "")
    line_text = os.environ.get("PR_LINE", "")
    if path or line_text:
        if not path or not line_text:
            die("--file and --line must be used together.")
        if not path.startswith("/"):
            path = "/" + path
        line_no = int(line_text)
        iteration_text = os.environ.get("PR_ITERATION", "")
        if not iteration_text:
            die("line comment needs a pull request iteration.")
        iteration_id = int(iteration_text)
        body["threadContext"] = {
            "filePath": path,
            "rightFileStart": {"line": line_no, "offset": 1},
            "rightFileEnd": {"line": line_no, "offset": 1},
        }
        body["pullRequestThreadContext"] = {
            "iterationContext": {
                "firstComparingIteration": iteration_id,
                "secondComparingIteration": iteration_id,
            }
        }
    print(json.dumps(body))
else:
    die("unknown formatter: %s" % op)
PY
}

detect_args() {
  DETECT_ARGS=(--detect true)
  if [[ -n "$ORG" ]]; then
    DETECT_ARGS+=(--org "$ORG")
  fi
}

signed_in_user() {
  local me
  me=$(az ad signed-in-user show --query userPrincipalName -o tsv 2>/dev/null || true)
  me=$(printf '%s' "$me" | tr -d '[:space:]')
  if [[ -z "$me" ]]; then
    me=$(az account show --query user.name -o tsv)
    me=$(printf '%s' "$me" | tr -d '[:space:]')
  fi
  if [[ -z "$me" ]]; then
    echo "ERROR: could not resolve signed-in user. Use --all or sign in with az login." >&2
    exit 1
  fi
  printf '%s\n' "$me"
}

cmd_list() {
  local me cmd
  ensure_tmp
  detect_args
  cmd=(az repos pr list --status "$STATUS" --include-links true)
  if [[ ${#DETECT_ARGS[@]} -gt 0 ]]; then
    cmd+=("${DETECT_ARGS[@]}")
  fi
  if [[ -n "$PROJECT" ]]; then
    cmd+=(--project "$PROJECT")
  fi
  if [[ -n "$REPOSITORY" ]]; then
    cmd+=(--repository "$REPOSITORY")
  fi
  if [[ "$ALL" -eq 0 ]]; then
    if [[ -n "$REVIEWER" ]]; then
      me="$REVIEWER"
    else
      me=$(signed_in_user)
    fi
    echo "Reviewer: $me"
    cmd+=(--reviewer "$me")
  fi
  "${cmd[@]}" -o json > "$TMP/list.json"
  py format-list "$TMP/list.json"
}

load_pr() {
  require_id
  ensure_tmp
  detect_args
  az repos pr show --id "$ID" "${DETECT_ARGS[@]}" -o json > "$TMP/pr.json"
}

cmd_show() {
  load_pr
  if ! az repos pr work-item list --id "$ID" "${DETECT_ARGS[@]}" -o json > "$TMP/wi.json" 2>"$TMP/wi.err"; then
    echo "[]" > "$TMP/wi.json"
    echo "WARN: could not list linked work items." >&2
    if [[ -s "$TMP/wi.err" ]]; then
      cat "$TMP/wi.err" >&2
    fi
  fi
  py format-show "$TMP/pr.json" "$TMP/wi.json"
}

az_rest() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    az rest --method "$method" --uri "$url" --resource "$ADO_RESOURCE" \
      --headers "Content-Type=application/json" \
      --body @"$body" -o json
  else
    az rest --method "$method" --uri "$url" --resource "$ADO_RESOURCE" -o json
  fi
}

run_diff() {
  set +e
  git diff "$@"
  local rc=$?
  set -e
  if [[ "$rc" -gt 1 ]]; then
    return "$rc"
  fi
  return 0
}

emit_git_diff() {
  local base="$1"
  local head="$2"
  local range="${base}...${head}"
  if [[ ${#PATH_FILTER[@]} -gt 0 ]]; then
    run_diff --stat "$range" -- "${PATH_FILTER[@]}"
    echo
    run_diff --name-status "$range" -- "${PATH_FILTER[@]}"
    if [[ "$FULL" -eq 1 ]]; then
      echo
      run_diff "$range" -- "${PATH_FILTER[@]}"
    fi
  else
    run_diff --stat "$range"
    echo
    run_diff --name-status "$range"
    if [[ "$FULL" -eq 1 ]]; then
      echo
      run_diff "$range"
    fi
  fi
}

repo_matches() {
  local remote answer
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 1
  remote=$(git remote get-url origin 2>/dev/null || true)
  [[ -n "$remote" ]] || return 1
  answer=$(py repo-match "$TMP/pr.json" "$remote")
  [[ "$answer" == "yes" ]]
}

diff_file_list() {
  local url iter
  iter=$(latest_iteration)
  if [[ -z "$iter" ]]; then
    echo "No file changes."
    return
  fi
  url=$(py changes-url "$TMP/pr.json" "$iter")
  az_rest GET "$url" > "$TMP/changes.json"
  if [[ ${#PATH_FILTER[@]} -gt 0 ]]; then
    py format-changes "$TMP/changes.json" "${PATH_FILTER[@]}"
  else
    py format-changes "$TMP/changes.json"
  fi
}

latest_iteration() {
  local url iter
  url=$(py iterations-url "$TMP/pr.json")
  az_rest GET "$url" > "$TMP/iterations.json"
  iter=$(py iteration-id "$TMP/iterations.json")
  printf '%s\n' "$iter"
}

cmd_diff() {
  local refs source_ref target_ref source_branch target_branch
  local dest_src dest_tgt diff_rc
  load_pr
  load_defaults
  refs=$(py diff-refs "$TMP/pr.json")
  source_ref=$(printf '%s\n' "$refs" | sed -n '1p')
  target_ref=$(printf '%s\n' "$refs" | sed -n '2p')
  source_branch=$(printf '%s\n' "$refs" | sed -n '3p')
  target_branch=$(printf '%s\n' "$refs" | sed -n '4p')
  echo "Diff PR ${ID}: ${source_branch} → ${target_branch}"
  if repo_matches; then
    dest_src="refs/pr-review/${ID}/source"
    dest_tgt="refs/pr-review/${ID}/target"
    # Script-owned refs only. Force-update so a later review can move them.
    if git fetch origin "+${source_ref}:${dest_src}" "+${target_ref}:${dest_tgt}"; then
      set +e
      emit_git_diff "$dest_tgt" "$dest_src"
      diff_rc=$?
      set -e
      git update-ref -d "$dest_src" >/dev/null 2>&1 || true
      git update-ref -d "$dest_tgt" >/dev/null 2>&1 || true
      return "$diff_rc"
    fi
    git update-ref -d "$dest_src" >/dev/null 2>&1 || true
    git update-ref -d "$dest_tgt" >/dev/null 2>&1 || true
    echo "WARN: git fetch failed." >&2
  else
    echo "Current repository does not match this pull request." >&2
  fi
  diff_file_list
  echo "Full patch needs a local clone of this repository."
}

cmd_threads() {
  local url
  load_pr
  load_defaults
  url=$(py threads-url "$TMP/pr.json")
  az_rest GET "$url" > "$TMP/threads.json"
  py format-threads "$TMP/threads.json"
}

cmd_comment() {
  local url
  if [[ -z "$TEXT" ]]; then
    echo "ERROR: --text is required." >&2
    usage_cmd comment >&2
    exit 1
  fi
  if [[ -n "$FILE" || -n "$LINE" ]]; then
    if [[ -z "$FILE" || -z "$LINE" ]]; then
      echo "ERROR: --file and --line must be used together." >&2
      exit 1
    fi
    if ! [[ "$LINE" =~ ^[0-9]+$ ]] || [[ "$LINE" -lt 1 ]]; then
      echo "ERROR: --line must be a positive integer." >&2
      exit 1
    fi
  fi
  load_pr
  load_defaults
  PR_ITERATION=""
  if [[ -n "$FILE" ]]; then
    PR_ITERATION=$(latest_iteration)
    if [[ -z "$PR_ITERATION" ]]; then
      echo "ERROR: pull request has no iteration to anchor the line comment." >&2
      exit 1
    fi
  fi
  py comment-body > "$TMP/comment.json"
  url=$(py threads-url "$TMP/pr.json")
  az_rest POST "$url" "$TMP/comment.json" > "$TMP/comment-result.json"
  echo "Comment posted on PR ${ID}."
}

cmd_vote() {
  local az_vote
  require_id
  case "$VOTE" in
    approve) az_vote="approve" ;;
    wait) az_vote="wait-for-author" ;;
    reject) az_vote="reject" ;;
    reset) az_vote="reset" ;;
    "")
      echo "ERROR: vote is required: approve, wait, reject, or reset." >&2
      usage_cmd vote >&2
      exit 1
      ;;
    *)
      echo "ERROR: unknown vote: $VOTE" >&2
      usage_cmd vote >&2
      exit 1
      ;;
  esac
  detect_args
  az repos pr set-vote --id "$ID" --vote "$az_vote" "${DETECT_ARGS[@]}" -o none
  echo "Vote sent: ${az_vote}"
}

case "$CMD" in
  list) cmd_list ;;
  show) cmd_show ;;
  diff) cmd_diff ;;
  threads) cmd_threads ;;
  comment) cmd_comment ;;
  vote) cmd_vote ;;
  *)
    echo "ERROR: unknown command: $CMD" >&2
    exit 1
    ;;
esac
