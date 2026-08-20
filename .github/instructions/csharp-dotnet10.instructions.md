---
applyTo: "**/*.{cs,csproj,sln,props,targets}"
---

# C# / .NET 10

- Target .NET 10 idioms: nullable reference types on, file-scoped namespaces, primary constructors where they clarify intent.
- Prefer async/await end-to-end for I/O; never block on `.Result` / `.Wait()`.
- Keep public APIs intentional; validate inputs at boundaries.
- Dependency injection: constructor injection; avoid service locators.
- Tests sit with the slice (unit + integration as needed). Name tests after behavior.
- No drive-by refactors outside the active work item.
- Follow skills `vertical-slice-dotnet` and `clean-code-csharp` when implementing features.
