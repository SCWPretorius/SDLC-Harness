# Cross-session memory

On-demand index for a later VS Code or OpenCode session in this multi-root workspace. Agents write it when a phase finishes. They do not copy Copilot session transcripts.

| Path | Role |
| --- | --- |
| `memory/INDEX.md` | One line per feature. Generated. Gitignored. |
| `memory/cards/<yyyy-mm-dd>-<slug>.md` | One short card per feature. Generated. Gitignored. |
| `templates/memory-card.md` | Card shape. Committed. |

`INDEX.md` and `cards/` are local. They are not part of the harness package, so `npx sdlc-copilot-harness update` does not overwrite them.

## Index line

```text
# Cross-session index
# date | slug | repos | status | ado | card
YYYY-MM-DD | slug | RepoA, RepoB | analyzed | | memory/cards/YYYY-MM-DD-slug.md
```

Status is `analyzed`, `prd-confirmed`, or `backlog`. A later phase must not downgrade it.

## Card

About 40 lines. Normal English.

- **Plan** — slice names and a link to `docs/analysis/`. Not a copy of the report.
- **PRD** — written only after the user confirms the chat PRD. Problem in 2–4 lines and confirmed slice names. Acceptance criteria stay on Azure DevOps work items.
- **ADO** — written only after `az` returns real IDs. `AB#` and title only.

Full rules: skill `cross-session-memory`.

## Recall

Do not open this folder on every turn. Open `INDEX.md` when the request names another repo, a prior feature, or asks what was planned. Open the one matching card. Open the linked analysis only when the card lacks a needed fact.

A window that does not include this harness cannot see the index.
