# Copilot model IDs (slugs)

Agent frontmatter `model:` must use **slug IDs**, not display names.

Example: `Claude Haiku 4.5` → `claude-haiku-4.5`

Prefer an **inline** list so `tools` / `handoffs` are not mistaken for more models:

```yaml
model: [gpt-5.6-terra, claude-sonnet-5]

tools:
  - agent

handoffs:
  - label: …
```

## Mapping used in this harness

| Display name | Slug |
|--------------|------|
| GPT-5.6 Terra | `gpt-5.6-terra` |
| GPT-5.6 Sol | `gpt-5.6-sol` |
| GPT-5.6 Luna | `gpt-5.6-luna` |
| GPT-5.5 | `gpt-5.5` |
| GPT-5.3-Codex | `gpt-5.3-codex` |
| Claude Opus 4.8 | `claude-opus-4.8` |
| Claude Sonnet 5 | `claude-sonnet-5` |
| Claude Sonnet 4.6 | `claude-sonnet-4.6` |
| Claude Haiku 4.5 | `claude-haiku-4.5` |
| Claude Fable 5 | `claude-fable-5` |
| Gemini 3.1 Pro | `gemini-3.1-pro-preview` |
| MAI-Code-1-Flash | `mai-code-1-flash` |
| MAI-Code-1.1-Flash | `mai-code-1.1-flash` |

## Agent assignments (standard)

| Agent | Primary | Fallbacks |
|-------|---------|-----------|
| `sdlc-orchestrator` | `gpt-5.6-terra` | `claude-sonnet-5` |
| `analyst` | `gpt-5.6-sol` | `gpt-5.5`, `claude-opus-4.8` |
| `tech-pm` | `claude-opus-4.8` | `gpt-5.6-sol`, `gpt-5.5` |
| `ado-planner` | `claude-sonnet-5` | `gpt-5.6-terra`, `claude-sonnet-4.6` |
| `ado-ops` | `gpt-5.6-luna` | `claude-haiku-4.5`, `mai-code-1-flash` |
| `implementer` | `gpt-5.3-codex` | `claude-sonnet-5`, `claude-fable-5` |
| `code-reviewer` | `gpt-5.6-sol` | `claude-opus-4.8`, `gemini-3.1-pro-preview` |

## Agent assignments (economy)

See [ECONOMY.md](ECONOMY.md). Separate `*-economy` agents; standard agents unchanged.

| Agent | Primary | Fallbacks |
|-------|---------|-----------|
| `sdlc-orchestrator-economy` | `gpt-5.6-luna` | `mai-code-1.1-flash` |
| `analyst-economy` | `gpt-5.6-terra` | `claude-sonnet-5` |
| `tech-pm-economy` | `claude-sonnet-5` | `gpt-5.6-terra` |
| `ado-planner-economy` | `gpt-5.6-terra` | `claude-sonnet-5` |
| `ado-ops-economy` | `gpt-5.6-luna` | `mai-code-1.1-flash`, `claude-haiku-4.5` |
| `implementer-economy` | `gpt-5.3-codex` | `claude-sonnet-5` |
| `code-reviewer-economy` | `claude-sonnet-5` | `gpt-5.6-terra` |

Also mapped: `mai-code-1.1-flash` ← MAI-Code-1.1-Flash

## Notes

- Prefer kebab-case slugs from the Copilot model catalog / CLI (`~/.copilot` / picker autocomplete).
- VS Code may also accept display names in some builds; slugs work for Copilot CLI and avoid mismatches.
- `gemini-3.1-pro-preview` is the catalog ID for Gemini 3.1 Pro (public preview).
- If a slug fails in your tenant, open the model picker autocomplete in an agent file and pick the offered ID.
