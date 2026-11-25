#!/usr/bin/env bash
# Open an Azure Repos pull request. Prints id and url only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_az.sh
source "${SCRIPT_DIR}/_az.sh"

SOURCE=""
TARGET=""
TITLE=""
DESCRIPTION=""

usage() {
  cat <<'EOF'
Usage:
  create-pr.sh --source <branch> --target <branch> --title <text> [--description <text>]

Description should include AB#<work-item-id>. The description is not printed back.

Stdout:
  PR_ID=<id>
  PR_URL=<url>
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="${2:-}"; shift 2 ;;
    --target) TARGET="${2:-}"; shift 2 ;;
    --title) TITLE="${2:-}"; shift 2 ;;
    --description) DESCRIPTION="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$SOURCE" || -z "$TARGET" || -z "$TITLE" ]]; then
  echo "ERROR: --source, --target, and --title are required." >&2
  usage >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI not found." >&2
  exit 1
fi

args=(repos pr create --source-branch "$SOURCE" --target-branch "$TARGET" --title "$TITLE")
if [[ -n "$DESCRIPTION" ]]; then
  args+=(--description "$DESCRIPTION")
fi
args+=(--query '[pullRequestId, url]' -o tsv)

line="$(ado_az "${args[@]}")"
IFS=$'\t' read -r pr_id pr_url <<<"$line" || true
pr_id="$(ado_trim_id "$pr_id")"
if [[ ! "$pr_id" =~ ^[0-9]+$ ]]; then
  echo "ERROR: failed to parse pull request id." >&2
  exit 1
fi
printf 'PR_ID=%s\nPR_URL=%s\n' "$pr_id" "$pr_url"
