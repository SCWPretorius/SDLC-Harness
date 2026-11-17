#!/usr/bin/env bash
# Update Azure DevOps work item state. Prints id and state only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_az.sh
source "${SCRIPT_DIR}/_az.sh"

ID=""
STATE=""

usage() {
  cat <<'EOF'
Usage:
  update-state.sh --id <WORK_ITEM_ID> --state <StateName>

Examples:
  update-state.sh --id 1234 --state Active
  update-state.sh --id 1234 --state Resolved

Stdout: id=<ID> state=<State>
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id) ID="${2:-}"; shift 2 ;;
    --state) STATE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$ID" || -z "$STATE" ]]; then
  echo "ERROR: --id and --state required." >&2
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

line="$(ado_az boards work-item update --id "$ID" --state "$STATE" \
  --query '[id, fields."System.State"]' -o tsv)"
IFS=$'\t' read -r id state <<<"$line" || true
id="$(ado_trim_id "$id")"
if [[ ! "$id" =~ ^[0-9]+$ ]]; then
  echo "ERROR: failed to parse id after state update." >&2
  exit 1
fi
printf 'id=%s state=%s\n' "$id" "$state"
