# Azure DevOps states (Agile default)

Process: Agile. Hierarchy: Epic → Feature → User Story → Task. Bugs attach under Feature or User Story.

## Feature / User Story

| State | When |
|-------|------|
| New | Created, not started |
| Active | Implementation in progress |
| Resolved | Work complete pending verification / feature integration |
| Closed | Accepted / done |

## Task

| State | When |
|-------|------|
| New | Created |
| Active | Being worked |
| Closed | Finished |

## Bug

Prefer project defaults. Common pattern: New → Active → Resolved → Closed. If the project uses only New → Active → Closed, follow that.

## Agent mapping

| Event | State change |
|-------|----------------|
| Planner creates items | New |
| Ops/implementer starts coding | → Active |
| PR merged to feature + AC met (story/feature) | → Resolved then Closed when accepted |
| Task finished | → Closed |
| Review bug filed | New |
| Fix started | → Active |
| Fix merged | → Closed (or Resolved→Closed) |

Use:

```bash
./scripts/ado/update-state.sh --id <ID> --state Active
```

Do not invent custom states. If the project customized names, list them once with the user and stick to those.
