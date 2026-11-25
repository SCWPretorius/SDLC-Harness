#!/usr/bin/env bash
# Create Epic, Feature, User Story, Task, and/or Bug. Stdout is ID lines only.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_az.sh
source "${SCRIPT_DIR}/_az.sh"

EPIC_ID=""
EPIC_TITLE=""
EPIC_DESC=""
FEATURE_TITLE=""
STORY_TITLE=""
TASK_TITLE=""
BUG_TITLE=""
FEATURE_DESC=""
STORY_DESC=""
TASK_DESC=""
BUG_DESC=""
PARENT_ID=""

usage() {
  cat <<'EOF'
Usage:
  create-hierarchy.sh --epic <title> [--epic-desc <text>]
  create-hierarchy.sh --epic-id <ID> --feature <title> [--feature-desc <text>]
                      [--story <title>] [--story-desc <text>]
                      [--task <title>] [--task-desc <text>]
  create-hierarchy.sh --parent-id <ID> --bug <title> [--bug-desc <text>]

Flags can combine (new Epic then children, or a slice plus a bug).
Stdout is ID lines only: EPIC_ID=, FEATURE_ID=, STORY_ID=, TASK_ID=, BUG_ID=.

Requires: az CLI, azure-devops extension, configured org/project defaults.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --epic-id) EPIC_ID="${2:-}"; shift 2 ;;
    --epic) EPIC_TITLE="${2:-}"; shift 2 ;;
    --epic-desc) EPIC_DESC="${2:-}"; shift 2 ;;
    --feature) FEATURE_TITLE="${2:-}"; shift 2 ;;
    --feature-desc) FEATURE_DESC="${2:-}"; shift 2 ;;
    --story) STORY_TITLE="${2:-}"; shift 2 ;;
    --story-desc) STORY_DESC="${2:-}"; shift 2 ;;
    --task) TASK_TITLE="${2:-}"; shift 2 ;;
    --task-desc) TASK_DESC="${2:-}"; shift 2 ;;
    --parent-id) PARENT_ID="${2:-}"; shift 2 ;;
    --bug) BUG_TITLE="${2:-}"; shift 2 ;;
    --bug-desc) BUG_DESC="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -z "$EPIC_TITLE" && -z "$FEATURE_TITLE" && -z "$BUG_TITLE" ]]; then
  echo "ERROR: pass --epic, --feature, or --bug." >&2
  usage >&2
  exit 1
fi

if [[ -n "$EPIC_TITLE" && -n "$EPIC_ID" ]]; then
  echo "ERROR: pass --epic or --epic-id, not both." >&2
  exit 1
fi

if [[ -n "$FEATURE_TITLE" && -z "$EPIC_ID" && -z "$EPIC_TITLE" ]]; then
  echo "ERROR: --feature needs --epic-id or --epic (Epic gate)." >&2
  usage >&2
  exit 1
fi

if [[ -n "$STORY_TITLE" && -z "$FEATURE_TITLE" ]]; then
  echo "ERROR: --story requires --feature." >&2
  exit 1
fi

if [[ -n "$TASK_TITLE" && -z "$FEATURE_TITLE" ]]; then
  echo "ERROR: --task requires --feature." >&2
  exit 1
fi

if [[ -n "$EPIC_ID" && ! "$EPIC_ID" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --epic-id must be numeric." >&2
  exit 1
fi

if [[ -n "$PARENT_ID" && ! "$PARENT_ID" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --parent-id must be numeric." >&2
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "ERROR: az CLI not found." >&2
  exit 1
fi

create_child() {
  local type="$1" title="$2" desc="$3" parent="$4"
  local -a args
  local id

  args=(boards work-item create --type "$type" --title "$title" --query id -o tsv)
  if [[ -n "$desc" ]]; then
    args+=(--description "$desc")
  fi

  if [[ -n "$parent" ]]; then
    if ! id="$(ado_az "${args[@]}" --relation "parent=${parent}" 2>/dev/null)"; then
      id="$(ado_az "${args[@]}")"
      id="$(ado_trim_id "$id")"
      if [[ ! "$id" =~ ^[0-9]+$ ]]; then
        echo "ERROR: failed to parse id for $type" >&2
        exit 1
      fi
      ado_az boards work-item relation add --id "$id" --relation-type parent --target-id "$parent" -o none >/dev/null
      printf '%s' "$id"
      return 0
    fi
  else
    id="$(ado_az "${args[@]}")"
  fi

  id="$(ado_trim_id "$id")"
  if [[ ! "$id" =~ ^[0-9]+$ ]]; then
    echo "ERROR: failed to parse id for $type" >&2
    exit 1
  fi
  printf '%s' "$id"
}

if [[ -n "$EPIC_TITLE" ]]; then
  EPIC_ID="$(create_child "Epic" "$EPIC_TITLE" "$EPIC_DESC" "")"
  echo "EPIC_ID=$EPIC_ID"
fi

if [[ -n "$FEATURE_TITLE" ]]; then
  FEATURE_ID="$(create_child "Feature" "$FEATURE_TITLE" "$FEATURE_DESC" "$EPIC_ID")"
  echo "FEATURE_ID=$FEATURE_ID"

  PARENT_FOR_TASK="$FEATURE_ID"
  if [[ -n "$STORY_TITLE" ]]; then
    STORY_ID="$(create_child "User Story" "$STORY_TITLE" "$STORY_DESC" "$FEATURE_ID")"
    echo "STORY_ID=$STORY_ID"
    PARENT_FOR_TASK="$STORY_ID"
  fi

  if [[ -n "$TASK_TITLE" ]]; then
    TASK_ID="$(create_child "Task" "$TASK_TITLE" "$TASK_DESC" "$PARENT_FOR_TASK")"
    echo "TASK_ID=$TASK_ID"
  fi
fi

if [[ -n "$BUG_TITLE" ]]; then
  BUG_PARENT="$PARENT_ID"
  if [[ -z "$BUG_PARENT" ]]; then
    BUG_PARENT="${STORY_ID:-${FEATURE_ID:-}}"
  fi
  if [[ -z "$BUG_PARENT" ]]; then
    echo "ERROR: --bug needs --parent-id or a feature/story created in this run." >&2
    exit 1
  fi
  BUG_ID="$(create_child "Bug" "$BUG_TITLE" "$BUG_DESC" "$BUG_PARENT")"
  echo "BUG_ID=$BUG_ID"
fi
