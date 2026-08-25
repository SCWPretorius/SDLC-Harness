# Economy agents

Credit-saving parallel agents. **Standard agents are unchanged.**

Use when you want lower AI-credit spend. Same SDLC rules (Epic gate, create backlog if missing, branching, caveman, CodeGraph).

## How to use

1. Open multi-root workspace as usual.
2. In Copilot Chat agents picker, choose **`sdlc-orchestrator-economy`** (not `sdlc-orchestrator`).
3. Stay on `*-economy` handoffs for the whole flow.

Escalate to standard agents only when user asks for full-quality (Sol/Opus) analysis or review.

## Models

Each economy agent file sets only the README model (no fallback list).

| Agent | Model |
|-------|-------|
| `sdlc-orchestrator-economy` | `gpt-5.6-luna` |
| `analyst-economy` | `gpt-5.6-terra` |
| `tech-pm-economy` | `claude-sonnet-5` |
| `ado-planner-economy` | `gpt-5.6-terra` |
| `ado-ops-economy` | `gpt-5.6-luna` |
| `implementer-economy` | `gpt-5.3-codex` |
| `code-reviewer-economy` | `claude-sonnet-5` |

Not used in economy defaults: `gpt-5.6-sol`, `claude-opus-4.8`.

## Files

`.github/agents/*-economy.agent.md`
