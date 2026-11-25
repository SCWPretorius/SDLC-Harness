#!/usr/bin/env bash
# List children of a work item. Prints id, type, state, title only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_az.sh
source "${SCRIPT_DIR}/_az.sh"

PARENT=""
TITLE=""

usage() {
  cat <<'EOF'
Usage:
  query.sh --parent <WORK_ITEM_ID> [--title <text>]

Stdout, one line per child:
  id=<ID> type=<Type> state=<State> title=<Title>

Empty when the parent has no matching children.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --parent) PARENT="${2:-}"; shift 2 ;;
    --title) TITLE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$PARENT" ]]; then
  echo "ERROR: --parent required." >&2
  usage >&2
  exit 1
fi

if [[ ! "$PARENT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --parent must be numeric." >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI not found." >&2
  exit 1
fi

WIQL="SELECT [System.Id] FROM WorkItems WHERE [System.Parent] = ${PARENT}"
if [[ -n "$TITLE" ]]; then
  safe="${TITLE//\'/\'\'}"
  WIQL="${WIQL} AND [System.Title] CONTAINS '${safe}'"
fi

tsv="$(ado_az boards query --wiql "$WIQL" \
  --query '[].[id, fields."System.WorkItemType", fields."System.State", fields."System.Title"]' \
  -o tsv)"

if [[ -z "$tsv" ]]; then
  exit 0
fi

while IFS=$'\t' read -r id type state title; do
  [[ -z "${id:-}" ]] && continue
  printf 'id=%s type=%s state=%s title=%s\n' "$id" "$type" "$state" "$title"
done <<<"$tsv"
exit 0
