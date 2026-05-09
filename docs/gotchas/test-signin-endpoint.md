# Endpoint `/api/test/sign-in` devuelve 404 en prod y 404 sin header `x-test-secret` correcto

Gate doble en el handler:

- `NODE_ENV === 'production'` → 404 sin leer body.
- Header `x-test-secret !== E2E_TEST_SECRET` → 404 (no 401 — evita enumeración).

**No eliminar el gate.**

Test unit cubre 3 paths (`src/app/api/test/sign-in/__tests__/route.test.ts`).
