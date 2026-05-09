# CI `e2e` job crea una branch Supabase efímera por run

`scripts/ci/branch-helpers.sh` wraps la Management API:

```
create → poll ACTIVE → fetch env → migrate → seed → test:rls → test:e2e → delete (always())
```

**GH Secrets requeridos:**

- `SUPABASE_ACCESS_TOKEN` (scope `projects:write`, `branches:write`)
- `SUPABASE_PROJECT_REF`
- `E2E_TEST_SECRET`

`concurrency.cancel-in-progress` evita branches leaked por pushes rápidos.

Falla con mensaje explícito si un secret falta — no degrada silenciosamente.
