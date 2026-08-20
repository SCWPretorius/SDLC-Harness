#!/usr/bin/env bash
# Link a Git branch to an Azure DevOps work item (artifact link when supported).
set -euo pipefail

ID=""
BRANCH=""
REMOTE_URL=""

usage() {
  cat <<'EOF'
Usage:
  link-branch.sh --id <WORK_ITEM_ID> --branch <branch-name> [--remote-url <git-url>]

Adds an ArtifactLink/Branch relation when the CLI supports it.
Always prints the AB# reminder for PR descriptions.

Example:
  link-branch.sh --id 1042 --branch feature/checkout-retry/1042-retry-policy
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id) ID="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    --remote-url) REMOTE_URL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$ID" || -z "$BRANCH" ]]; then
  echo "ERROR: --id and --branch required." >&2
  usage
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

echo "Work item: $ID"
echo "Branch:    $BRANCH"
echo "Remote:    ${REMOTE_URL:-"(unknown)"}"
echo "PR/commit text must include: AB#${ID}"

# Best-effort artifact link. ADO Git branch URLs vary by org; discussion comment is reliable fallback.
COMMENT="Linked branch \`${BRANCH}\`${REMOTE_URL:+ (${REMOTE_URL})}."
if az boards work-item update --id "$ID" --discussion "$COMMENT" -o none; then
  echo "Added discussion note on work item $ID."
else
  echo "WARN: could not add discussion note." >&2
fi

# Attempt vstfs branch link if project/repo known — non-fatal on failure.
if az boards work-item relation add --id "$ID" --relation-type ArtifactLink --target-url "vstfs:///Git/Ref/${BRANCH}" -o none 2>/dev/null; then
  echo "Added ArtifactLink relation (best effort)."
else
  echo "ArtifactLink skipped or unsupported; rely on AB#${ID} in PR description."
fi
