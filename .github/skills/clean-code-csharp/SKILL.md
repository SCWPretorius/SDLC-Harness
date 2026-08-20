---
name: clean-code-csharp
description: >
  Clean code practices for C# implementation and review: naming, SRP, small
  methods, testability, no drive-by refactors. Use when writing or reviewing .NET code.
---

# Clean code (C#)

## Rules

- Names reveal intent; avoid abbreviations except well-known ones (`Id`, `Http`, `Dto` if project uses them).
- Methods do one thing; classes have one reason to change.
- Prefer pure functions for domain decisions when practical.
- Keep constructors thin; no heavy work in ctors.
- Guard clauses at boundaries; fail fast with clear exceptions/results.
- Avoid commenting what code already says; comment only non-obvious why.
- No dead code, no commented-out blocks, no speculative abstractions.
- Match project analyzer / style rules (EditorConfig, analyzers).

## Refactors

- Only refactor what the active work item needs.
- If you spot unrelated debt, document it as a finding / follow-up work item — do not expand scope silently.

## Tests

- Arrange-Act-Assert clarity.
- Test behavior, not private implementation details.
- Deterministic; no flaky time/network without fakes.
