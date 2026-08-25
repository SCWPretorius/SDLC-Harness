# Copilot model IDs (slugs)

Agent frontmatter `model:` must use a **single slug ID**, not a display name and not a fallback list.

Example: `Claude Sonnet 5` → `claude-sonnet-5`

```yaml
model: gpt-5.6-terra

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
| GPT-5.3-Codex | `gpt-5.3-codex` |
| Claude Opus 4.8 | `claude-opus-4.8` |
| Claude Sonnet 5 | `claude-sonnet-5` |

## Agent assignments (standard)

| Agent | Model |
|-------|-------|
| `sdlc-orchestrator` | `gpt-5.6-terra` |
| `analyst` | `gpt-5.6-sol` |
| `tech-pm` | `claude-opus-4.8` |
| `ado-planner` | `claude-sonnet-5` |
| `ado-ops` | `gpt-5.6-luna` |
| `implementer` | `gpt-5.3-codex` |
| `code-reviewer` | `gpt-5.6-sol` |

## Agent assignments (economy)

See [ECONOMY.md](ECONOMY.md). Separate `*-economy` agents; standard agents unchanged.

| Agent | Model |
|-------|-------|
| `sdlc-orchestrator-economy` | `gpt-5.6-luna` |
| `analyst-economy` | `gpt-5.6-terra` |
| `tech-pm-economy` | `claude-sonnet-5` |
| `ado-planner-economy` | `gpt-5.6-terra` |
| `ado-ops-economy` | `gpt-5.6-luna` |
| `implementer-economy` | `gpt-5.3-codex` |
| `code-reviewer-economy` | `claude-sonnet-5` |

## Notes

- Prefer kebab-case slugs from the Copilot model catalog / CLI (`~/.copilot` / picker autocomplete).
- VS Code may also accept display names in some builds; slugs work for Copilot CLI and avoid mismatches.
- If a slug fails in your tenant, open the model picker autocomplete in an agent file and pick the offered ID.
