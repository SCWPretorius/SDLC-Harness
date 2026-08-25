# Publishing `sdlc-copilot-harness`

So others can run `npx sdlc-copilot-harness`.

npm now requires **2FA** or a **granular access token with “Bypass 2FA”** to publish. A plain `npm login` session is not enough.

## 1. Package metadata

Set the real `repository.url` in `package.json` (not the `github.com/example/...` placeholder).

## 2. Authenticate for publish

**Recommended (interactive):** enable 2FA on the npm account, then publish and enter the one-time code.

1. Open [npm two-factor auth](https://www.npmjs.com/settings/~/security/2fa) while logged in as the publisher.
2. Enable 2FA (authenticator app).
3. Confirm: `npm profile get` should show `two-factor auth: auth-and-writes` (or similar, not `disabled`).
4. From the repo root:

```bash
npm publish --access public
```

When prompted, enter the authenticator code. You can also pass it once:

```bash
npm publish --access public --otp=123456
```

**Automation / no OTP prompt:** create a [granular access token](https://www.npmjs.com/settings/~/tokens/new) on the website (not `npm token create`):

- Permission: **Read and write**
- Packages: this package (or “all” if it does not exist yet)
- Check **Bypass two-factor authentication**
- Short expiry

Then:

```bash
export NPM_TOKEN=npm_...   # do not commit this
npm publish --access public --//registry.npmjs.org/:_authToken="${NPM_TOKEN}"
```

## Scoped name (optional)

```json
"name": "@your-org/sdlc-copilot-harness"
```

```bash
npm publish --access public
```

## Not on npm yet

```bash
npx --yes github:ORG/REPO
# or clone and:
node bin/install.mjs
```
