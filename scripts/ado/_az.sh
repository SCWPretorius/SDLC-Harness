#!/usr/bin/env bash
# Quiet az wrapper. Source from other scripts/ado/*.sh. Do not execute.
# Keeps preview warnings and telemetry off the agent transcript.

export AZURE_CORE_ONLY_SHOW_ERRORS=true
export AZURE_CORE_COLLECT_TELEMETRY=false

ado_az() {
  az --only-show-errors "$@"
}

# Strip whitespace so a tsv id is a bare number.
ado_trim_id() {
  local raw="$1"
  raw="${raw//$'\r'/}"
  raw="${raw//$'\n'/}"
  raw="${raw//[[:space:]]/}"
  printf '%s' "$raw"
}
