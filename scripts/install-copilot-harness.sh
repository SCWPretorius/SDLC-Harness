#!/usr/bin/env bash
# Install SDLC harness agents/skills into ~/.copilot for personal Copilot use.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="symlink" # symlink | copy
TARGET_BASE="${HOME}/.copilot"

usage() {
  cat <<'EOF'
Usage:
  install-copilot-harness.sh [--copy|--symlink]

  --symlink  (default) ln -sfn agents and skills into ~/.copilot
  --copy     copy trees instead of symlinking

Also prints CodeGraph + az checklist.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --copy) MODE="copy"; shift ;;
    --symlink) MODE="symlink"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 1 ;;
  esac
done

mkdir -p "${TARGET_BASE}/agents" "${TARGET_BASE}/skills"

link_or_copy() {
  local src="$1" dest="$2"
  if [[ "$MODE" == "copy" ]]; then
    rm -rf "$dest"
    mkdir -p "$(dirname "$dest")"
    cp -R "$src" "$dest"
    echo "copied $src → $dest"
  else
    mkdir -p "$(dirname "$dest")"
    ln -sfn "$src" "$dest"
    echo "linked $dest → $src"
  fi
}

# Agents: each *.agent.md
shopt -s nullglob
for f in "${ROOT}/.github/agents/"*.agent.md; do
  base="$(basename "$f")"
  link_or_copy "$f" "${TARGET_BASE}/agents/${base}"
done

# Skills: each skill directory
for d in "${ROOT}/.github/skills/"*; do
  [[ -d "$d" ]] || continue
  name="$(basename "$d")"
  link_or_copy "$d" "${TARGET_BASE}/skills/${name}"
done
shopt -u nullglob

# Instructions hint (workspace-level still preferred)
if [[ -f "${ROOT}/.github/copilot-instructions.md" ]]; then
  echo
  echo "Note: Keep using workspace .github/copilot-instructions.md when the harness folder is open."
  echo "Personal agents/skills installed under: ${TARGET_BASE}"
fi

cat <<'EOF'

Checklist
---------
[ ] az login && az extension add --name azure-devops --upgrade
[ ] az devops configure --defaults organization=... project=...
[ ] codegraph install --target=copilot-vscode --yes
[ ] codegraph init in each product repo
[ ] Restart VS Code / Copilot
[ ] Open multi-root workspace (templates/sdlc.code-workspace)
[ ] Chat: Configure Custom Agents → confirm sdlc-orchestrator

Docs: docs/SETUP.md
EOF
