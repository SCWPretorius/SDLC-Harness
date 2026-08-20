---
applyTo: "**/*.{bicep,bicepparam,tf,tfvars,yml,yaml,json}"
---

# Azure platform

- Prefer managed identity over secrets in app config when possible.
- Keep infrastructure changes scoped to the vertical slice; document new resources in the PRD / work item.
- Use least-privilege RBAC and Key Vault references for secrets.
- Align naming with existing subscription / resource group conventions in the workspace.
- For App Service, Functions, Container Apps, Service Bus, Storage, Cosmos, SQL: match patterns already in the product repos before inventing new ones.
- Never commit secrets, connection strings with keys, or `.env` files with credentials.
