---
name: codegraph-usage
description: >
  Use CodeGraph MCP for semantic code intelligence before grep/glob sweeps.
  Trigger when analyzing codebases, finding call paths, blast radius, symbols,
  dependencies, implementing features, or reviewing changes across C#/.NET repos.
---

# CodeGraph usage

Prefer CodeGraph over blind file crawling. Fewer tool calls, surgical context.

## Prerequisites

1. CLI installed: `curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh` or `npm i -g @colbymchenry/codegraph`
2. Agent wiring: `codegraph install --target=copilot-vscode --yes`
3. Per product repo: `cd <repo> && codegraph init`
4. Restart VS Code / Copilot after install

Confirm `.codegraph/` exists in each product folder before deep analysis. If missing, run `codegraph init` (ask user if unsure about side effects).

## Multi-repo

- Each product repo has its own graph. Init/index **per folder**.
- When workspace has multiple roots, query CodeGraph in the repo that owns the symbol/path you care about.
- Cite `repo-name` in every finding.

## How to work

1. Ask CodeGraph for symbols, call paths, dependents, and blast radius first.
2. Only then open files CodeGraph pointed at.
3. Use grep/glob for strings CodeGraph cannot answer (config keys, comments, non-indexed assets).
4. After large edits, rely on auto-sync; do not manually reindex unless graph looks stale.

## Anti-patterns

- Do not dump entire files into context when a graph query returns the relevant slice.
- Do not skip CodeGraph because "it is a small change" — still check callers.
- Do not invent MCP tool names; use the tools CodeGraph exposes in the session.

Upstream: https://github.com/colbymchenry/codegraph
