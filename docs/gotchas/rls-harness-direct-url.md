# RLS harness usa `DIRECT_URL` (session mode, puerto 5432 del pooler)

`SET LOCAL request.jwt.claims` no persiste en transaction pooler (puerto 6543); el harness lo re-afirma en su header.

Cada caso del harness:

1. Abre tx.
2. Seedea como `postgres` super.
3. `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', …, true)`.
4. Ejecuta queries bajo RLS.
5. `ROLLBACK`.

Sin firma de JWTs. Patrón oficial Supabase para testing de RLS.

Ver `tests/rls/harness.ts`.
