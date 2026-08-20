#!/usr/bin/env bash
# Update Azure DevOps work item state.
set -euo pipefail

ID=""
STATE=""

usage() {
  cat <<'EOF'
Usage:
  update-state.sh --id <WORK_ITEM_ID> --state <StateName>

Examples:
  update-state.sh --id 1234 --state Active
  update-state.sh --id 1234 --state Resolved
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id) ID="${2:-}"; shift 2 ;;
    --state) STATE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$ID" || -z "$STATE" ]]; then
  echo "ERROR: --id and --state required." >&2
  usage
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI not found." >&2
  exit 1
fi

az boards work-item update --id "$ID" --state "$STATE" -o table
echo "Updated work item $ID → $STATE"
