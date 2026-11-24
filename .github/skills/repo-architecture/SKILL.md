---
name: repo-architecture
description: >
  Diagram sibling repositories with Archify and keep an updatable cross-repo
  integration list for GitHub Copilot in VS Code. Use when the user asks to
  map a repository's architecture, add or change how repositories integrate,
  or refresh the integration diagram. Diagrams and the list live in the
  parent architecture folder, not in the harness package.
---

# Repository architecture

Draw architecture for named sibling repositories, and keep a list of how those repositories integrate. [Archify](https://github.com/tt-a1i/archify) renders the diagrams. This skill does not vendor Archify and does not create Azure DevOps work items.

Run it in GitHub Copilot in VS Code, on the machine whose parent folder holds the harness next to the product repos. Install Archify there for the `github-copilot` agent, and only after the user confirms that scope.

## Paths

The harness folder is the directory that contains `.github/skills/repo-architecture/SKILL.md`.

- **Parent** — the directory that contains the harness folder and the sibling repos.
- **Architecture root** — `<parent>/architecture`. Create it on first use. Write diagrams and the integration list only here.
- **Templates** — `<harness>/templates/architecture/`.

Do not write diagram JSON, HTML, or `integrations.yaml` inside a product repo or inside the harness package.

If this session cannot see the parent folder (a single product git root, no sibling repos), stop and tell the user to open the multi-root workspace from the parent.

## First use

When `<parent>/architecture` is missing, create it. Copy a template file only when the destination file is absent:

- `<harness>/templates/architecture/README.md` → `<parent>/architecture/README.md`
- `<harness>/templates/architecture/integrations.yaml` → `<parent>/architecture/integrations.yaml`

Never overwrite an existing `integrations.yaml` or `README.md`.

## Archify

Archify is required before validate or deliver. Search the path the installer reported, then:

- `~/.copilot/skills/archify/bin/archify.mjs`
- `~/.agents/skills/archify/bin/archify.mjs`

If `bin/archify.mjs` is missing, tell the user what will run and wait for confirmation. Do not install during that explanation.

1. Discover only. Stop unless the listing contains exactly one skill named `archify`.

```bash
npx -y skills@latest add https://archify.si --list --full-depth
```

2. Inspect the install destination. If it already contains unmanaged files, stop and report them. Do not delete them.

3. Install for GitHub Copilot:

```bash
npx -y skills@latest add https://archify.si --skill archify --agent github-copilot --global --copy --yes
```

4. Verify:

```bash
node <installed-archify>/bin/archify.mjs doctor
```

`<installed-archify>` is the directory the installer reported. Continue only when doctor succeeds. Do not copy Archify into this repository.

## Diagram one repository

Do this only when the user names a repository, including the harness folder itself. Leave every unnamed sibling alone.

1. Read that sibling. Prefer CodeGraph when `.codegraph/` exists; otherwise read the entry points, project files, and docs needed for a high-level map.
2. Author an Archify architecture document at `<parent>/architecture/repos/<Folder>/architecture.json`.
   - About 8–12 components, one primary path, external dependencies, and trust boundaries when the repo has them.
   - Put evidence in cards (repo-relative paths). Do not add a node per file.
   - `meta.title` names the folder. `meta.quality_profile` is `showcase`.
3. Validate, then deliver:

```bash
node <installed-archify>/bin/archify.mjs validate architecture <parent>/architecture/repos/<Folder>/architecture.json --quality showcase --json
node <installed-archify>/bin/archify.mjs deliver architecture <parent>/architecture/repos/<Folder>/architecture.json <parent>/architecture/repos/<Folder>/architecture.html --quality showcase --json
```

`<Folder>` is the sibling directory name, unchanged (`Contoso.Api`, `SDLC Harness`). Apply only the repair controls Archify returns, and stop after two failed correction rounds. Tell the user the HTML path when deliver succeeds.

## Integration list

`<parent>/architecture/integrations.yaml` is the only source of truth. Add, edit, and remove links by editing that file. Keep each `id` stable across edits.

```yaml
version: 1
links: []
# - id: web-to-api
#   from: Fabrikam.Web          # sibling folder name
#   to: Contoso.Api
#   kind: http                  # http | grpc | event | package | database | other
#   label: calls orders API
#   contract: POST /api/orders  # optional
#   notes: ""                   # optional
#   evidence: ""                # optional path relative to `from`
```

Required on every link: `id`, `from`, `to`, `kind`, `label`. `from` and `to` must be sibling directory names (the harness folder counts). Reject a duplicate `id`, an unknown `kind`, or a `from`/`to` folder that is not in the parent.

When `links` is empty, do not create or refresh `integrations.architecture.json` or `integrations.html`.

When the user adds, changes, or removes links and at least one link remains:

1. Update `<parent>/architecture/integrations.architecture.json`.
   - One component per repository that appears in `from` or `to`. Component `label` is the folder name. Component `id` is a stable slug: lowercase, and spaces, dots, and other punctuation become hyphens (`Fabrikam.Web` → `fabrikam-web`). If two folders would share a slug, stop and ask.
   - One connection per link. Connection `id` is the link `id`. Connection label is the link `label`, then `kind`, then `contract` when present: `calls orders API (http POST /api/orders)`.
   - Put `kind`, `contract`, `notes`, and `evidence` in cards. Do not add nodes for them.
   - When a previous JSON exists, keep `pos` and `size` for component ids that are still present. Keep `fromSide`, `toSide`, and `via` when a connection still joins the same two components. Place only new components.
2. Validate, then deliver:

```bash
node <installed-archify>/bin/archify.mjs validate architecture <parent>/architecture/integrations.architecture.json --quality showcase --json
node <installed-archify>/bin/archify.mjs deliver architecture <parent>/architecture/integrations.architecture.json <parent>/architecture/integrations.html --quality showcase --json
```

Tell the user which link ids changed and the HTML path.

## Chat

Follow the harness chat style. `integrations.yaml`, the copied README, and Archify JSON stay normal English.
