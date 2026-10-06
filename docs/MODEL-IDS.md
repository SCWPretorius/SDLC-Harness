# Copilot model IDs (slugs)

Agent frontmatter `model:` must use a **single slug ID**, not a display name and not a fallback list.

Example: `Claude Sonnet 5.5` → `claude-sonnet-5.5`

```yaml
model: gpt-6-sol

tools:
  - agent

handoffs:
  - label: …
```

## Mapping used in this harness

| Display name | Slug | Why this harness uses it |
|--------------|------|--------------------------|
| GPT-6 Sol | `gpt-6-sol` | All-round interactive and agentic coding |
| GPT-6.1 Sol | `gpt-6.1-sol` | Complex coding with efficient multistep reasoning |
| GPT-6 Luna | `gpt-6-luna` | Fast, low-cost repetitive tasks |
| GPT-6 Astra | `gpt-6-astra` | Long-horizon autonomous coding |
| Claude Opus 5.5 | `claude-opus-5.5` | Long-running agentic work and collaboration |
| Claude Sonnet 5.5 | `claude-sonnet-5.5` | General agent tasks with fewer steps and tokens |

Claude Fable 5.1 is GA for deep codebase research, but Copilot Business and Enterprise leave it off by default and it is outside the zero-data-retention agreement. This harness does not pin it.

## Agent assignments (standard)

| Agent | Model |
|-------|-------|
| `sdlc-orchestrator` | `gpt-6-sol` |
| `analyst` | `gpt-6.1-sol` |
| `tech-pm` | `claude-opus-5.5` |
| `ado-planner` | `claude-sonnet-5.5` |
| `ado-ops` | `gpt-6-luna` |
| `implementer` | `gpt-6-astra` |
| `code-reviewer` | `gpt-6.1-sol` |

## Agent assignments (economy)

See [ECONOMY.md](ECONOMY.md). Separate `*-economy` agents; standard agents unchanged.

| Agent | Model |
|-------|-------|
| `sdlc-orchestrator-economy` | `gpt-6-luna` |
| `analyst-economy` | `gpt-6-sol` |
| `tech-pm-economy` | `claude-sonnet-5.5` |
| `ado-planner-economy` | `gpt-6-sol` |
| `ado-ops-economy` | `gpt-6-luna` |
| `implementer-economy` | `gpt-6.1-sol` |
| `code-reviewer-economy` | `claude-sonnet-5.5` |

## Notes

- Prefer kebab-case slugs from the Copilot model catalog / CLI (`~/.copilot` / picker autocomplete).
- VS Code may also accept display names in some builds; slugs work for Copilot CLI and avoid mismatches.
- If a slug fails in your tenant, open the model picker autocomplete in an agent file and pick the offered ID.

## OpenCode

Generated `.opencode/agents/*.md` files **omit** `model`. OpenCode uses `provider/model-id`, which is not compatible with Copilot slugs.

Set the session model with `/models`, or pin a default in `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-5-5"
}
```

Optional starting points if you want to pin per-agent later (edit generated files only if you stop using `bin/sync-opencode-agents.mjs`, or re-apply after sync). Exact provider ids differ; pick the same family from `/models`:

| Copilot slug | Suggested OpenCode id (depends on provider) |
|--------------|-----------------------------------------------|
| `gpt-6-luna` | `openai/gpt-6-luna` or OpenCode Zen equivalent |
| `gpt-6-sol` / `gpt-6.1-sol` | `openai/gpt-6-sol` or `openai/gpt-6.1-sol` |
| `gpt-6-astra` | `openai/gpt-6-astra` if the provider exposes it |
| `claude-opus-5.5` | `anthropic/claude-opus-5-5` |
| `claude-sonnet-5.5` | `anthropic/claude-sonnet-5-5` |

Economy in OpenCode is still the `*-economy` agents (Tab to `sdlc-orchestrator-economy`). Pick a cheaper model in `/models` if you want extra savings on top of the cheaper Copilot mapping.
