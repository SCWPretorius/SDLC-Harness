# Economy agents

Credit-saving parallel agents. **Standard agents are unchanged.**

Use when you want lower AI-credit spend. Same SDLC rules (Epic gate, create backlog if missing, branching, caveman, CodeGraph).

## How to use

**Copilot**

1. Open multi-root workspace as usual.
2. In Copilot Chat agents picker, choose **`sdlc-orchestrator-economy`** (not `sdlc-orchestrator`).
3. Stay on `*-economy` handoffs for the whole flow.

**OpenCode**

1. `cd` to the parent folder and run `opencode`.
2. Tab to **`sdlc-orchestrator-economy`**.
3. Stay on `*-economy` Task / `@` targets for the whole flow.

Escalate to standard agents only when user asks for full-quality (Sol/Opus/Astra) analysis or review.

## Models

Each Copilot economy agent file sets only the README model (no fallback list). OpenCode economy agents inherit the user’s `/models` default (no Copilot slugs).

| Agent | Model |
|-------|-------|
| `sdlc-orchestrator-economy` | `gpt-6-luna` |
| `analyst-economy` | `gpt-6-sol` |
| `tech-pm-economy` | `claude-sonnet-5.5` |
| `ado-planner-economy` | `gpt-6-sol` |
| `ado-ops-economy` | `gpt-6-luna` |
| `implementer-economy` | `gpt-6.1-sol` |
| `code-reviewer-economy` | `claude-sonnet-5.5` |

Not used in economy defaults: `gpt-6-astra`, `claude-opus-5.5`.

## Files

`.github/agents/*-economy.agent.md` (source)  
`.opencode/agents/*-economy.md` (generated)
