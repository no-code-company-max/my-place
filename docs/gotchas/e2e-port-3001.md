# E2E local corre en puerto 3001, no 3000

Para evitar colisión con dev servers de otros proyectos del host.

`playwright.config.ts` setea:

- `reuseExistingServer: false`
- `pnpm dev --port 3001`
- override de `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_DOMAIN` en `webServer.env`.

Cookies cross-subdomain siguen OK (`cookie-domain.ts` strippea puerto antes de setear `Domain=lvh.me`).
