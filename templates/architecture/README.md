# Architecture diagrams

This folder sits beside the SDLC Harness and the product repositories. GitHub Copilot creates it on first use. It is not part of the harness package.

Open any `.html` file here in a browser. Archify is not required to view a diagram.

## One repository

Ask Copilot to diagram a sibling by its directory name, for example: "Diagram Contoso.Api". The harness folder itself is allowed when you name it.

Output:

```text
repos/<Folder>/architecture.json
repos/<Folder>/architecture.html
```

`<Folder>` is the directory name, unchanged.

## How repositories integrate

`integrations.yaml` is the list. Edit that file, or ask Copilot to edit it. Copilot does not keep a second copy.

Add a link:

```yaml
version: 1
links:
  - id: web-to-api
    from: Fabrikam.Web
    to: Contoso.Api
    kind: http
    label: calls orders API
    contract: POST /api/orders
```

- `from` and `to` are sibling folder names.
- `kind` is one of `http`, `grpc`, `event`, `package`, `database`, `other`.
- `id` stays the same when you change a link. Delete an entry to remove that link.
- `contract`, `notes`, and `evidence` are optional. `evidence` is a path relative to `from`.

An empty `links` list does not produce an integration diagram. After you add or change links, ask Copilot: "Update the integration diagram."

That refreshes:

```text
integrations.architecture.json
integrations.html
```

Repositories that were already on the diagram keep their positions. New repositories are placed around them.
