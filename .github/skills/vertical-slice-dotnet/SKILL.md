---
name: vertical-slice-dotnet
description: >
  Implement C# .NET 10 features as vertical slices end-to-end (API/UI → application
  → domain → infrastructure → tests). Use during implementation and bug fixes.
---

# Vertical feature slices (.NET 10)

## Principle

Ship one thin end-to-end capability per work item. Avoid horizontal layer tickets ("do all repositories first").

## Slice shape

For each Feature / Story:

1. Contract / API endpoint or message handler
2. Application use-case / handler
3. Domain rules needed for this slice only
4. Infrastructure adapters (EF, Service Bus, Blob, etc.)
5. Tests proving the slice
6. Minimal IaC / config only if the slice needs it

## Practices

- Keep files cohesive around the slice; follow existing project structure.
- Share code only when duplication clearly hurts; prefer local clarity.
- Feature flags when rolling out risky behavior.
- Match existing DI, logging, and error patterns in the target repo.
- Use CodeGraph to find extension points and callers before editing.

## Done means

- Acceptance criteria for the slice met
- Tests green for touched paths
- Work-item branch pushed; PR opened to **feature** branch
- Ready for `code-reviewer`
