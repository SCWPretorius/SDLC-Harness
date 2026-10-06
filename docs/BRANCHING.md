# Branching

Full mode uses the tree below. Direct mode with no work item ID stays on the current branch. When the user asks for a branch and there is no ID, create `feature/<slug>` only — no work-item segment and no `AB#` link.

## Strategy

```text
main
 └── feature/<feature-slug>
      └── feature/<feature-slug>/<work-item-id>-short-name
           └── PR ──► feature/<feature-slug>
```

After the Feature is complete, integrate `feature/<feature-slug>` → `main` via a separate PR (human-controlled release cadence).

## Rules

1. Full mode: do not implement directly on `main`. Direct mode with no work item ID uses the current branch.
2. Do not open work-item PRs targeting `main` unless the user explicitly overrides.
3. One primary work item per work-item branch.
4. Include `AB#<id>` in PR description (and commits when helpful).
5. Link branch to the work item with `scripts/ado/link-branch.sh` when possible.

## Examples

Feature slug: `checkout-retry`  
Story id: `1042`  
Branch: `feature/checkout-retry/1042-retry-policy`

```bash
git checkout main && git pull
git checkout -b feature/checkout-retry
git push -u origin HEAD

git checkout -b feature/checkout-retry/1042-retry-policy
# ... implement ...
git push -u origin HEAD

az repos pr create \
  --source-branch feature/checkout-retry/1042-retry-policy \
  --target-branch feature/checkout-retry \
  --title "Retry policy for checkout" \
  --description "AB#1042"
```

See skill `ado-branching`.
