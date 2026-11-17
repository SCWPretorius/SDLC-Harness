#!/usr/bin/env bash
# Show one work item as id, type, state, and title. No JSON.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_az.sh
source "${SCRIPT_DIR}/_az.sh"

ID=""

usage() {
  cat <<'EOF'
Usage:
  show.sh --id <WORK_ITEM_ID>

Stdout: id=<ID> type=<Type> state=<State> title=<Title>
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id) ID="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$ID" ]]; then
  echo "ERROR: --id required." >&2
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

line="$(ado_az boards work-item show --id "$ID" \
  --query '[id, fields."System.WorkItemType", fields."System.State", fields."System.Title"]' \
  -o tsv)"
IFS=$'\t' read -r id type state title <<<"$line" || true
id="$(ado_trim_id "$id")"
if [[ ! "$id" =~ ^[0-9]+$ ]]; then
  echo "ERROR: failed to parse work item $ID" >&2
  exit 1
fi
printf 'id=%s type=%s state=%s title=%s\n' "$id" "$type" "$state" "$title"
