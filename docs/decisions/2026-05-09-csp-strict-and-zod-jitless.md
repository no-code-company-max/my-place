# CSP estricta en prod + Zod 4 en modo `jitless`

**Fecha:** 2026-05-09
**Estado:** Aceptada
**Origen:** Reporte en producción — `the-company.place.community/conversations/una-prueba-adicional` mostró el error boundary "No pudimos cargar las conversaciones ahora" tras hard refresh, sin nada en runtime logs de Vercel. La browser DevTools Console reportaba violación CSP `script-src` por `eval`/`new Function(...)` en el chunk client `7367-ddba26c34fe43139.js`.

## Contexto

La CSP de prod definida en `next.config.ts:40` es:

```
script-src 'self' 'unsafe-inline'
```

(En dev se relaja con `'unsafe-eval'` para HMR de Next.) La directiva prod **no permite** `eval`, `new Function(...)`, ni compilación dinámica de strings como JS. El navegador bloquea cualquier intento y, si el call site no tiene fallback, lanza `EvalError` síncrono.

Inspección del chunk culpable (`grep -oE ".{120}Function\(.{120}"`) reveló dos invocaciones:

1. Un feature-detect: `try { return Function(""), true } catch { return false }` — benigno (try/catch).
2. Un método `compile()` de la clase interna del schema: `return Function(...this.args, this.content.join("\n"))` — **sin guard**, propaga el throw.

El sufijo del chunk contenía `tS = { major: 4, minor: 3, patch: 6 }` y `c("$ZodType", ...)`. Confirmado: **Zod 4.3.6 JIT compiler**.

Zod 4 introdujo un compilador JIT de schemas que precompila validadores con `new Function(...)` para acelerar `parse()`. En entornos con CSP estricta sin `'unsafe-eval'`, el JIT crashea. El síntoma server-side es invisible: el throw ocurre en el browser cuando `react-hook-form` con `zodResolver` (o cualquier validación client-side de Zod) precompila un schema.

## Alternativas consideradas

### A. Permitir `'unsafe-eval'` en `script-src` de prod

Unblock inmediato y robusto frente a regresiones futuras de Zod o de cualquier otra dep. **Descartada**: degrada significativamente la postura de seguridad. Place acepta UGC pesado (Lexical/TipTap, comments, menciones, library items con embeds). Una eventual XSS que logre inyectar un string en cualquier `eval`/`Function` call escala de "DOM injection" a "code execution". CSP `script-src` sin `'unsafe-eval'` es la última línea de defensa contra esa clase de ataque y no la queremos abrir por una limitación de una librería.

### B. Mover toda validación Zod fuera del bundle cliente

Refactor de `react-hook-form` + `zodResolver` para validar sólo server-side via Server Actions. Arquitectónicamente puro y alineado con el principio "validar en boundaries". **Descartada por costo/beneficio**: pierde la UX de validación instantánea client-side (delay del round-trip por cada submit con error), invasiva (toca cada formulario del producto), y no resuelve el problema general de "qué pasa cuando otra dep client-bundle use `eval` mañana" — sólo elimina a Zod del bundle.

### C. Upgrade Zod + opt-in explícito a `jitless` mode (elegida)

Zod 4.4.x agregó `z.config({ jitless: true })`: opt-out global del JIT, fuerza el modo interpreter (validación recorriendo el AST del schema en runtime, sin compilar). El chunk muestra el guard explícito en el call site:

```js
let c = !r.cr.jitless
// ...más adelante:
if (l(h)) c && p && d?.async === false && !d.jitless ? <JIT path> : <interpreter path>
```

Con `jitless: true`, `c = false` y todo el branch JIT (incluyendo el feature-detect que invoca `Function("")`) queda corto-circuitado. El método `compile()` queda como código muerto en el chunk — definido, nunca invocado.

Trade-off: el modo interpreter es **marginalmente más lento** que el JIT (Zod afirma 2-10x según schema). A nuestra escala (validación de forms + payloads de Server Actions) la diferencia es irrelevante. Si en el futuro un endpoint con throughput alto necesita JIT, se puede activar selectivamente.

## Decisión

1. **Pin Zod a 4.4.x o superior** (upgrade desde 4.3.6 → 4.4.3).
2. **`z.config({ jitless: true })` global**, ejecutado al boot tanto en server como en client. Implementado vía:
   - `src/shared/config/zod-runtime.ts` — módulo isomórfico con el side-effect `z.config(...)`.
   - `src/shared/config/zod-runtime-client.tsx` — wrapper `'use client'` que importa el side-effect y exporta `<ZodRuntime />` (componente vacío, render `null`).
   - `src/app/layout.tsx` — `import '@/shared/config/zod-runtime'` (ejecuta en el server bundle del root layout) + `<ZodRuntime />` montado en `<body>` (ejecuta en el client bundle del root layout).
3. **CSP queda estricta** — no se toca `next.config.ts`. `script-src 'self' 'unsafe-inline'` sigue siendo el contrato.

## Consecuencias

- **Postura de seguridad intacta**: CSP estricta sigue mitigando XSS-via-eval.
- **Performance**: validación Zod marginalmente más lenta. Sin impacto medible esperado al volumen actual.
- **Dependencia upstream**: dependemos de que Zod mantenga el flag `jitless` y la dual implementation (JIT + interpreter). Es una feature pública documentada, no un detalle interno; baja probabilidad de remoción silenciosa.
- **Otras deps con `eval`**: el grep de los chunks post-fix muestra `Function(` sólo en `webpack-runtime.js` (`Function("return this")()` para detectar `globalThis` — pattern estándar y permitido por la mayoría de browsers en este contexto) y `polyfills.js` (feature-detect equivalente). Ninguno bloquea funcionalidad. Si una dep futura introduce `eval` que sí rompa, el plan de respuesta es:
  1. Confirmar con build local + `grep Function\(` en chunks.
  2. Buscar opt-out de la dep (como el `jitless` de Zod).
  3. Si no hay opt-out: lazy-load la dep o reemplazar por alternativa CSP-safe.
  4. **Sólo como último recurso**: ADR nuevo proponiendo apertura controlada de CSP.

## Verificación pre-deploy

```bash
pnpm build
# Localizar el chunk con Zod (cambia hash entre versiones)
for f in .next/static/chunks/*.js; do
  if grep -q 'jitless' "$f"; then
    echo "Zod chunk: $f"
    grep -oE ".{40}!r\.cr\.jitless.{40}" "$f" | head -3
  fi
done
```

Esperado: el guard `c=!r.cr.jitless` aparece en el chunk → `jitless` está cableado correctamente.

## Verificación post-deploy

1. Hard refresh en `<placeSlug>.place.community/conversations/<postSlug>` con DevTools abierto.
2. **Console tab**: no debería aparecer ningún reporte CSP de tipo `script-src ... 'unsafe-eval'`.
3. **Network tab**: el chunk de Zod debería cargar 200 y la página debería renderizar el contenido normal (no el error boundary "Algo no salió bien").

Si la violación CSP reaparece tras un upgrade futuro de Zod (4.5.x+), revisar si el flag `jitless` cambió de nombre o semántica — el chunk debería seguir mostrando un guard equivalente al `c = !r.cr.jitless` actual.
