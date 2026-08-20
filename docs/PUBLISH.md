# Publishing `sdlc-copilot-harness`

So others can run `npx sdlc-copilot-harness`:

1. Set the real `repository.url` in `package.json`.
2. Ensure you are logged in: `npm login`
3. From the repo root:

```bash
npm publish --access public
```

Or publish under a scope:

```json
"name": "@your-org/sdlc-copilot-harness"
```

```bash
npm publish --access public
```

Private / not on npm yet:

```bash
npx --yes github:ORG/REPO
# or clone and:
node bin/install.mjs
```
