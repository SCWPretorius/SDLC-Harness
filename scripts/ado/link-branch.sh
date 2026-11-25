#!/usr/bin/env bash
# Link a Git branch to an Azure DevOps work item via a discussion note.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_az.sh
source "${SCRIPT_DIR}/_az.sh"

ID=""
BRANCH=""
REMOTE_URL=""

usage() {
  cat <<'EOF'
Usage:
  link-branch.sh --id <WORK_ITEM_ID> --branch <branch-name> [--remote-url <git-url>]

Adds a discussion note on the work item.
PR and commit text must still include AB#<id> (not printed here).

Example:
  link-branch.sh --id 1042 --branch feature/checkout-retry/1042-retry-policy

Stdout: linked id=<ID> branch=<branch>
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id) ID="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    --remote-url) REMOTE_URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$ID" || -z "$BRANCH" ]]; then
  echo "ERROR: --id and --branch required." >&2
  usage >&2
  exit 1
fi

if [[ ! "$ID" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --id must be numeric." >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI not found." >&2
  exit 1
fi

if [[ -z "$REMOTE_URL" ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
  fi
fi

COMMENT="Linked branch \`${BRANCH}\`${REMOTE_URL:+ (${REMOTE_URL})}."
ado_az boards work-item update --id "$ID" --discussion "$COMMENT" -o none >/dev/null
printf 'linked id=%s branch=%s\n' "$ID" "$BRANCH"
