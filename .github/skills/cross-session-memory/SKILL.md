---
name: cross-session-memory
description: >
  Read and update the harness cross-session memory index. Use when a new session
  must recall a feature planned in another repo, and when analysis, a confirmed
  chat PRD, or ADO work items are finished. Do not read Copilot session transcripts.
---

# Cross-session memory

Compact index in the harness. A later session in the same multi-root workspace can open one card. Full analysis stays in `docs/analysis/`. Acceptance criteria stay on Azure DevOps work items. Chat PRDs stay in chat.

Do not read `.copilot` session stores or transcripts. Do not copy a session into memory.

## Layout

- `memory/INDEX.md` — one feature per line. Grep this file. Do not load every card.
- `memory/cards/<yyyy-mm-dd>-<slug>.md` — one card per feature, updated in place.
- Template: `templates/memory-card.md`. Normal English. About 40 lines maximum.

Card filename stem matches the analysis file stem. Example: `docs/analysis/2026-11-17-billing-export.md` → `memory/cards/2026-11-17-billing-export.md`.

If there is no analysis file (direct mode), use today's date and a kebab-case title: `memory/cards/<yyyy-mm-dd>-<slug>.md`.

## Recall

Do not open memory on every turn.

Open `memory/INDEX.md` only when the request names another repo, a prior feature, or asks what was planned. Then open the one matching card. Open the linked analysis file only when the card lacks a needed fact.

A window that does not include this harness cannot see the index.

## Write

Write once, at the end of the phase that produced the artifact. Not on every turn. Not from a watcher. Direct mode still writes the section for the artifact that agent actually produced.

Create `memory/` and `memory/cards/` if they are missing. If `memory/INDEX.md` is missing, create it with this header and then one feature line:

```text
# Cross-session index
# date | slug | repos | status | ado | card
```

Index line (single line, no wrapping):

```text
YYYY-MM-DD | slug | RepoA, RepoB | status | AB#1 AB#2 | memory/cards/YYYY-MM-DD-slug.md
```

- `slug` is the feature slug without the date prefix.
- `status` is `analyzed`, `prd-confirmed`, or `backlog`.
- `ado` is space-separated `AB#` ids, or empty before backlog.
- Replace the existing line whose card path matches. Otherwise append one line.
- Never downgrade status. A later re-analysis keeps `prd-confirmed` or `backlog`.

### Who fills which section

| Phase | When | Card section | Status after |
| --- | --- | --- | --- |
| `analyst` | Analysis file exists | **Plan** — slice names only, plus the analysis path. Do not copy the report. | `analyzed` |
| `tech-pm` | User confirmed the chat PRD | **PRD** — problem in 2–4 lines, confirmed slice names, repos. No acceptance-criteria essay. | `prd-confirmed` |
| `ado-planner` | `az` returned real IDs | **ADO** — one `AB#` and title per line. No descriptions. | `backlog` |

Upsert the same card. Do not create a second card for a later phase. Edit only the section this phase owns, plus `Updated` and `Status`.

Leave sections you do not own as the template placeholder.

## Forbidden

- `docs/prd/`, `docs/reviews/`, or a backlog summary file
- Pasting acceptance criteria, the analysis body, or session quotes into the card
- Reading `.copilot` sessions to build memory
- Opening every card at the start of a session
