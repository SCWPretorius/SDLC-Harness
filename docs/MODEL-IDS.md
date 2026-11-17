# Copilot model IDs (slugs)

Agent frontmatter `model:` must use a **single slug ID**, not a display name and not a fallback list.

Example: `Claude Sonnet 5.5` → `claude-sonnet-5.5`

```yaml
model: gpt-6.1-terra

tools:
  - agent

handoffs:
  - label: …
```

Catalog checked 2026-11-17 against [Supported AI models](https://docs.github.com/en/copilot/reference/ai-models/supported-models) and [AI model comparison](https://docs.github.com/en/copilot/reference/ai-models/model-comparison). GitHub publishes display names. Slugs below are the kebab-case Copilot ids.

## Available models

| Display name | Slug | Provider | Task fit | Pinned |
|--------------|------|----------|----------|--------|
| GPT-5.3-Codex | `gpt-5.3-codex` | OpenAI | Agentic software development; long-term support fallback | No |
| GPT-5.4 nano | `gpt-5.4-nano` | OpenAI | Codex extension only, not Copilot Chat | No |
| GPT-5.6 Luna | `gpt-5.6-luna` | OpenAI | Fast help; older Luna family | No |
| GPT-5.6 Sol | `gpt-5.6-sol` | OpenAI | Deep reasoning over large codebases; older Sol family | No |
| GPT-6 Astra | `gpt-6-astra` | OpenAI | Long-horizon autonomous coding | Yes |
| GPT-6 Luna | `gpt-6-luna` | OpenAI | Fast, low-cost repetitive tasks | Yes |
| GPT-6 Sol | `gpt-6-sol` | OpenAI | Interactive agentic coding; heavier than Terra | No |
| GPT-6.1 Sol | `gpt-6.1-sol` | OpenAI | Complex coding with efficient multistep reasoning | Yes |
| GPT-6.1 Terra | `gpt-6.1-terra` | OpenAI | Everyday agentic coding; GitHub’s general default | Yes |
| Claude Fable 5 | `claude-fable-5` | Anthropic | Long-horizon coding; off by default, outside ZDR | No |
| Claude Fable 5.1 | `claude-fable-5.1` | Anthropic | Long-horizon coding; off by default, outside ZDR | No |
| Claude Fable 5.2 | `claude-fable-5.2` | Anthropic | Long-horizon coding; off by default, outside ZDR | No |
| Claude Haiku 4.5 | `claude-haiku-4.5` | Anthropic | Fast lightweight answers | No |
| Claude Haiku 5.5 | `claude-haiku-5.5` | Anthropic | Fast lightweight answers | No |
| Claude Opus 5.5 | `claude-opus-5.5` | Anthropic | Long-running agentic work and collaboration | Yes |
| Claude Sonnet 4.6 | `claude-sonnet-4.6` | Anthropic | General coding; annual individual plans only after 2026-09-01 | No |
| Claude Sonnet 5 | `claude-sonnet-5` | Anthropic | General agent tasks | No |
| Claude Sonnet 5.5 | `claude-sonnet-5.5` | Anthropic | Efficient general agent work, fewer steps and tokens | Yes |
| Gemini 3.8 Flash | `gemini-3.8-flash` | Google | Fast lightweight answers | No |
| Gemini 4 Argon | `gemini-4-argon` | Google | Thorough work that tests edge cases | No |
| Gemini 4 Carbon | `gemini-4-carbon` | Google | Security-focused code | No |
| Gemini 4 Hydrogen | `gemini-4-hydrogen` | Google | Fast agentic coding | No |
| MAI-Code-1.1-Flash | `mai-code-1.1-flash` | Microsoft | Fast code completions | No |
| Kimi K3 | `kimi-k3` | Moonshot AI | Long-context agent work; open-weight, off by default | No |
| Grok 4.5 | `grok-4.5` | xAI | General coding and agent tasks | No |
| Grok 4.6 | `grok-4.6` | xAI | General coding and agent tasks | No |
| Grok 4.7 | `grok-4.7` | xAI | Agentic coding and multistep workflows | No |

Claude Fable 5, 5.1, and 5.2 are GA for long-horizon coding, but Copilot Business and Enterprise leave them off by default and they sit outside the zero-data-retention agreement. This harness does not pin them.

Kimi K3 is open-weight, off by default on Business and Enterprise, and GitHub notes extra safety safeguards. This harness does not pin it.

Retired 2026-11-16, so this harness does not pin them: Claude Opus 4.8, Claude Opus 5, GPT-5.6 Terra. Opus 5.5 is the latest Opus still generally available.

## Agent assignments (standard)

| Agent | Model |
|-------|-------|
| `sdlc-orchestrator` | `gpt-6.1-terra` |
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
| `analyst-economy` | `gpt-6.1-terra` |
| `tech-pm-economy` | `claude-sonnet-5.5` |
| `ado-planner-economy` | `gpt-6.1-terra` |
| `ado-ops-economy` | `gpt-6-luna` |
| `implementer-economy` | `gpt-6.1-sol` |
| `code-reviewer-economy` | `claude-sonnet-5.5` |

Economy defaults avoid `gpt-6-astra` and `claude-opus-5.5`.

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
| `gpt-6.1-terra` | `openai/gpt-6.1-terra` |
| `gpt-6-sol` / `gpt-6.1-sol` | `openai/gpt-6-sol` or `openai/gpt-6.1-sol` |
| `gpt-6-astra` | `openai/gpt-6-astra` if the provider exposes it |
| `claude-opus-5.5` | `anthropic/claude-opus-5-5` |
| `claude-sonnet-5.5` | `anthropic/claude-sonnet-5-5` |

Economy in OpenCode is still the `*-economy` agents (Tab to `sdlc-orchestrator-economy`). Pick a cheaper model in `/models` if you want extra savings on top of the cheaper Copilot mapping.
