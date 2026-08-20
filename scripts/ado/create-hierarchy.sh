#!/usr/bin/env bash
# Create Feature (and optional User Story / Task) under an Epic.
set -euo pipefail

EPIC_ID=""
FEATURE_TITLE=""
STORY_TITLE=""
TASK_TITLE=""
FEATURE_DESC=""
STORY_DESC=""
TASK_DESC=""

usage() {
  cat <<'EOF'
Usage:
  create-hierarchy.sh --epic-id <ID> --feature <title> [--feature-desc <text>]
                      [--story <title>] [--story-desc <text>]
                      [--task <title>] [--task-desc <text>]

Requires: az CLI, azure-devops extension, configured org/project defaults.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --epic-id) EPIC_ID="${2:-}"; shift 2 ;;
    --feature) FEATURE_TITLE="${2:-}"; shift 2 ;;
    --feature-desc) FEATURE_DESC="${2:-}"; shift 2 ;;
    --story) STORY_TITLE="${2:-}"; shift 2 ;;
    --story-desc) STORY_DESC="${2:-}"; shift 2 ;;
    --task) TASK_TITLE="${2:-}"; shift 2 ;;
    --task-desc) TASK_DESC="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$EPIC_ID" || -z "$FEATURE_TITLE" ]]; then
  echo "ERROR: --epic-id and --feature are required (Epic gate)." >&2
  usage
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI not found." >&2
  exit 1
fi

create_child() {
  local type="$1" title="$2" desc="$3" parent="$4"
  local args=(boards work-item create --type "$type" --title "$title" -o json)
  if [[ -n "$desc" ]]; then
    args+=(--description "$desc")
  fi
  local json id
  json="$(az "${args[@]}")"
  id="$(echo "$json" | sed -n 's/.*"id":[[:space:]]*\([0-9]*\).*/\1/p' | head -1)"
  if [[ -z "$id" ]]; then
    echo "ERROR: failed to parse id for $type '$title'" >&2
    echo "$json" >&2
    exit 1
  fi
  az boards work-item relation add --id "$id" --relation-type parent --target-id "$parent" -o none
  echo "$type id=$id parent=$parent title=$title" >&2
  echo "$id"
}

FEATURE_ID="$(create_child "Feature" "$FEATURE_TITLE" "$FEATURE_DESC" "$EPIC_ID" | tail -1)"
echo "FEATURE_ID=$FEATURE_ID"

PARENT_FOR_TASK="$FEATURE_ID"
if [[ -n "$STORY_TITLE" ]]; then
  STORY_ID="$(create_child "User Story" "$STORY_TITLE" "$STORY_DESC" "$FEATURE_ID" | tail -1)"
  echo "STORY_ID=$STORY_ID"
  PARENT_FOR_TASK="$STORY_ID"
fi

if [[ -n "$TASK_TITLE" ]]; then
  TASK_ID="$(create_child "Task" "$TASK_TITLE" "$TASK_DESC" "$PARENT_FOR_TASK" | tail -1)"
  echo "TASK_ID=$TASK_ID"
fi
