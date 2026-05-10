# Pre-launch checklist

Cosas que están en el repo a propósito **durante MVP / pre-launch** y que tienen que limpiarse antes del lanzamiento público (production final, abrir registro, etc.).

Cada entry: qué es, dónde vive, por qué se dejó, cómo revertirlo.

## Cómo usar este doc

- Antes de lanzar a prod final: leer entera, revertir cada item documentado, marcar como "removido" abajo (o borrar la entry).
- Cuando agregás algo "DEBUG TEMPORAL" o equivalente en una sesión: sumar entry acá con la fecha + commit + paths.
- El comentario en código debe linkear a este doc: `// DEBUG TEMPORAL — ver docs/pre-launch-checklist.md`.

## Pendientes

### Instrumentación de diagnóstico — error en /conversations (2026-05-09)

**Origen:** commit `7c329f4` (`chore(debug): instrumentar conversations + global error listener + smtp resend doc`).

**Por qué se dejó:** el bug de `cannot add presence callbacks ... after subscribe()` se identificó y fixeó en commit `1bba053`, pero los logs se mantienen a pedido del owner mientras el producto está en pre-launch — sirven como red de seguridad para diagnóstico inmediato si aparece OTRO síntoma client-side similar (throws masked por Next 15 en prod, runtime logs de Vercel vacíos por throws client).

**Archivos a tocar (revertir):**

1. **`src/app/layout.tsx`**
   - Quitar `import { GlobalErrorListener } from '@/shared/lib/diagnostics/global-error-listener-client'`.
   - Quitar `<GlobalErrorListener />` del `<body>`.
   - **Mantener** el `import '@/shared/config/zod-runtime'` y el `<ZodRuntime />` — son el fix real de CSP/Zod, NO debug.

2. **`src/shared/lib/diagnostics/global-error-listener-client.tsx`** — **borrar el archivo completo**. El directorio `diagnostics/` queda vacío, considerar borrar también.

3. **`src/shared/config/zod-runtime.ts`**
   - Quitar el bloque `if (typeof console !== 'undefined') { console.log('[zod-runtime] jitless bootstrapped', ...) }` (DEBUG TEMPORAL).
   - **Mantener** el `z.config({ jitless: true })` — es el fix real.

4. **`src/app/[placeSlug]/(gated)/conversations/error.tsx`**
   - Volver al `useEffect` minimal que sólo loguea `error.message + digest + stack + name` (versión del commit `a994f24`).
   - Quitar el `console.group`, el `Object.fromEntries(Object.entries(error))`, el `context: { url, timestamp, userAgent }`.
   - **Mantener** el render del `digest` y `message` en la UI — es observabilidad mínima útil para usuarios reportando bugs (también está en el commit `a994f24` original).

5. **`src/app/[placeSlug]/(gated)/conversations/[postSlug]/page.tsx`**
   - Quitar los `.catch(...)` con `logger.error` alrededor de `loadPlaceBySlug` y `findPostBySlug` — vuelven a ser `await` directos.
   - Quitar el `import { logger } from '@/shared/lib/logger'` si no queda otro uso.

6. **`src/app/[placeSlug]/(gated)/conversations/[postSlug]/_thread-content.tsx`**
   - Inline el `renderThreadContent` de vuelta dentro de `ThreadContent`, removiendo el wrapper try/catch + `logger.error`.
   - El `getEvent(...).catch(...)` interno **se mantiene** — eso es manejo de error legítimo, no debug.

7. **`src/app/[placeSlug]/(gated)/conversations/[postSlug]/_comments-section.tsx`** — mismo patrón: inline `renderCommentsSection` de vuelta, quitar try/catch + logger.

8. **`src/app/[placeSlug]/(gated)/conversations/[postSlug]/_thread-header-actions.tsx`** — mismo: inline `renderThreadHeaderActions`, quitar wrapper.

**Cómo encontrar todos:** `grep -rn "DEBUG TEMPORAL" src/` debería devolver 0 entradas después de la limpieza (ahora devuelve ~7 bullets).

**Test post-revert:** `pnpm typecheck` + `pnpm test` deben quedar verdes. Ningún funcionalidad cambia — sólo se quita instrumentación.

---

(otros items futuros van acá con su propio header `### Título — fecha`)
