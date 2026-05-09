# CSP de prod sin `'unsafe-eval'` + Zod 4 → bootstrap obligatorio con `z.config({ jitless: true })`

La CSP prod (`next.config.ts:40`) es `script-src 'self' 'unsafe-inline'` — sin `'unsafe-eval'` ni `'wasm-unsafe-eval'`. Cualquier dep client que llame `eval` o `new Function(...)` rompe en prod.

Zod 4 introdujo un JIT compiler que precompila validators con `new Function(...)` y throwea bajo CSP estricta.

**Síntoma:** el browser muestra "Algo no salió bien" + reporte CSP en DevTools Console (`script-src blocked: <chunk>.js`); runtime logs de Vercel quedan vacíos porque el throw es 100% client-side.

**Mitigación implementada:**

- `src/shared/config/zod-runtime.ts` — isomórfico, llama `z.config({ jitless: true })`.
- `src/shared/config/zod-runtime-client.tsx` — `<ZodRuntime />` para el bundle cliente.
- Ambos cableados en `src/app/layout.tsx`.

**No remover** estos imports — el JIT vuelve a estar activo por default si se borra el `z.config` y la página vuelve a romper en prod (en dev no se nota porque la CSP de dev incluye `'unsafe-eval'`).

**Si en el futuro otra dep client introduce `eval`/`Function`:**

1. Verificar con `pnpm build && grep -lE 'Function\(' .next/static/chunks/*.js`.
2. Buscar opt-out de la dep antes de tocar la CSP.

ADR completo: `docs/decisions/2026-05-09-csp-strict-and-zod-jitless.md`.
