# Economy agents

Credit-saving parallel agents. **Standard agents are unchanged.**

Use when you want lower AI-credit spend. Same SDLC rules (Epic gate, create backlog if missing, branching, caveman, CodeGraph).

## How to use

1. Open multi-root workspace as usual.
2. In Copilot Chat agents picker, choose **`sdlc-orchestrator-economy`** (not `sdlc-orchestrator`).
3. Stay on `*-economy` handoffs for the whole flow.

Escalate to standard agents only when user asks for full-quality (Sol/Opus) analysis or review.

## Models

| Agent | Primary | Fallbacks |
|-------|---------|-----------|
| `sdlc-orchestrator-economy` | `gpt-5.6-luna` | `mai-code-1.1-flash` |
| `analyst-economy` | `gpt-5.6-terra` | `claude-sonnet-5` |
| `tech-pm-economy` | `claude-sonnet-5` | `gpt-5.6-terra` |
| `ado-planner-economy` | `gpt-5.6-terra` | `claude-sonnet-5` |
| `ado-ops-economy` | `gpt-5.6-luna` | `mai-code-1.1-flash`, `claude-haiku-4.5` |
| `implementer-economy` | `gpt-5.3-codex` | `claude-sonnet-5` |
| `code-reviewer-economy` | `claude-sonnet-5` | `gpt-5.6-terra` |

Not used in economy defaults: `gpt-5.6-sol`, `gpt-5.5`, `claude-opus-4.8`, `claude-fable-5`.

## Files

`.github/agents/*-economy.agent.md`
