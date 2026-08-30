#!/usr/bin/env bash
# Install SDLC harness agents/skills into ~/.config/opencode for personal OpenCode use.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="symlink" # symlink | copy
TARGET_BASE="${HOME}/.config/opencode"

usage() {
  cat <<'EOF'
Usage:
  install-opencode-harness.sh [--copy|--symlink]

  --symlink  (default) ln -sfn agents and skills into ~/.config/opencode
  --copy     copy trees instead of symlinking

Also prints CodeGraph + az checklist.

Launch OpenCode from the parent folder (sibling product repos), not from a
single product git root:

  cd /path/to/parent && opencode
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

if [[ ! -d "${ROOT}/.opencode/agents" ]]; then
  echo "Generating OpenCode agents from Copilot sources…"
  node "${ROOT}/bin/sync-opencode-agents.mjs" "${ROOT}"
fi

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

shopt -s nullglob
for f in "${ROOT}/.opencode/agents/"*.md; do
  base="$(basename "$f")"
  link_or_copy "$f" "${TARGET_BASE}/agents/${base}"
done

for d in "${ROOT}/.github/skills/"*; do
  [[ -d "$d" ]] || continue
  name="$(basename "$d")"
  link_or_copy "$d" "${TARGET_BASE}/skills/${name}"
done
shopt -u nullglob

upsert_agents_md() {
  local src="${ROOT}/AGENTS.md"
  local dest="${TARGET_BASE}/AGENTS.md"
  [[ -f "$src" ]] || return 0
  node --input-type=module -e '
    import fs from "node:fs";
    import path from "node:path";
    const begin = "<!-- SDLC-HARNESS:BEGIN -->";
    const end = "<!-- SDLC-HARNESS:END -->";
    const src = process.argv[1];
    const dest = process.argv[2];
    const block = `${begin}\n${fs.readFileSync(src, "utf8").trim()}\n${end}\n`;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, block);
      console.log("created " + dest);
      process.exit(0);
    }
    const current = fs.readFileSync(dest, "utf8");
    const i = current.indexOf(begin);
    const j = current.indexOf(end);
    if (i !== -1 && j !== -1 && j > i) {
      const after = current.slice(j + end.length).replace(/^\n/, "");
      fs.writeFileSync(dest, current.slice(0, i) + block + after);
      console.log("updated " + dest);
    } else {
      const sep = current.endsWith("\n") ? "\n" : "\n\n";
      fs.writeFileSync(dest, current + sep + block);
      console.log("appended " + dest);
    }
  ' "$src" "$dest"
}

upsert_agents_md

echo
echo "Personal OpenCode agents/skills installed under: ${TARGET_BASE}"
echo "Prefer launching from the parent folder so all sibling repos are visible."

cat <<'EOF'

Checklist
---------
[ ] az login && az extension add --name azure-devops --upgrade
[ ] az devops configure --defaults organization=... project=...
[ ] codegraph install --target=opencode --yes
[ ] codegraph init in each product repo
[ ] Restart OpenCode
[ ] cd <parent> && opencode
[ ] Tab → sdlc-orchestrator (or sdlc-orchestrator-economy)

Docs: docs/SETUP.md
EOF
