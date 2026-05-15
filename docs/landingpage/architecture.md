# Landing — arquitectura

> Dónde vive la landing, cómo se rutea, cómo se renderiza, qué NO puede
> tocar. Coherente con `src/middleware.ts` y `docs/multi-tenancy.md`
> **existentes** — esta spec NO modifica el middleware.

## 1. Ruteo: la landing es el apex (kind `marketing`)

El ruteo ya existe y NO se toca. Resumen del flujo (ver `src/middleware.ts`
+ `src/shared/lib/host.ts`):

- `resolveHost(hostname, appDomain)` devuelve `{ kind: 'marketing' }`
  cuando el host es exactamente el apex (`place.community` en prod,
  `lvh.me:3000` en dev) **o** `www.<apex>` **o** un host no reconocido
  (fallback seguro).
- En `middleware.ts`, `gate()` deja pasar `kind === 'marketing'` SIN
  exigir sesión (`if (resolution.kind === 'marketing') return null`). →
  **La landing es pública por diseño del middleware actual.** No hay que
  tocar el gate.
- En `middleware.ts`, `route()` para `kind: 'marketing'` hace
  `NextResponse.next()` (no rewrite a `/inbox` ni a `/[slug]`),
  normalizando el pathname. → **El apex sirve el árbol de `src/app/`
  raíz tal cual.**

Conclusión: la página servida en el apex es **`src/app/page.tsx`** (hoy
es el placeholder de Fase 8). La landing reemplaza ese contenido.

> Nota sobre `multi-tenancy.md`: el doc describe un grupo de rutas
> `(marketing)/` que **no existe en el código actual** (no hay
> `src/app/(marketing)/`; el apex sirve `src/app/page.tsx` directo). Ver
> § "Ubicación propuesta" para la decisión.

## 2. Ubicación propuesta en el repo

**Propuesta (coherente con el middleware actual, sin route group nuevo):**

```
src/app/
├── page.tsx                 ← REEMPLAZA el placeholder. Server Component
│                              estático. Es la landing servida en el apex.
├── layout.tsx               ← root layout EXISTENTE (no se toca; ya monta
│                              Inter + Fraunces self-hosted vía next/font).
└── _landing/                ← carpeta privada (prefijo `_` = no ruteable
    │                          en App Router) con los componentes de la
    │                          landing. Aísla la landing del resto de app/.
    ├── hero.tsx
    ├── value-prop.tsx
    ├── how-it-works.tsx
    ├── cta.tsx
    └── footer.tsx
```

Razones de esta ubicación:

- **El middleware ya sirve `src/app/page.tsx` en el apex.** No hace falta
  inventar `src/app/(marketing)/`: agregar un route group implicaría mover
  `page.tsx` y validar que el `route()` de `kind: 'marketing'` (que NO
  reescribe) siga resolviendo. Menos superficie de cambio = menos riesgo
  de regresión en el ruteo multi-tenant.
- **`_landing/`** (carpeta con guión bajo) es ignorada por el router de
  Next → los componentes no crean rutas accidentales en ningún subdomain.
- Si el owner prefiere el route group `(landing)/` documentado
  conceptualmente en `multi-tenancy.md`, es viable pero requiere validar
  el `route()` del middleware y actualizar ese doc. **[A DEFINIR con
  owner — ver D1/estructura]**. La propuesta default es la de arriba por
  mínimo riesgo.

### Por qué la landing NO es una feature de `src/features/`

`src/features/` es para rebanadas verticales del **producto interno**
(discusiones, eventos, miembros, etc. — con datos, RLS, tests de dominio).
La landing no tiene dominio, ni datos, ni RLS: es una página de
presentación pública estática. Ponerla en `features/` violaría el modelo
mental del slice (una feature tiene `public.ts`, datos y tests de
comportamiento; la landing no tiene nada de eso). Vive en `src/app/`
como page + componentes privados.

## 3. Estrategia de rendering (cómo se logra el < 200ms)

### Server Component 100% estático (SSG / prerender)

- `src/app/page.tsx` es un **Server Component sin `async` de datos**:
  CERO `await` de Supabase/Prisma, CERO `fetch`, CERO `cookies()`,
  CERO `headers()`. No depende de la request.
- Resultado: Next la **prerenderiza en build** (static). En Vercel se
  sirve desde el **CDN edge** como HTML estático → TTFB ~ latencia de red
  al edge (decenas de ms), sin cómputo de servidor.
- **Forzar estático explícitamente** en `page.tsx`:
  ```ts
  export const dynamic = 'force-static'
  export const revalidate = false   // contenido cambia con un deploy, no por tiempo
  ```
  Esto documenta la intención y rompe el build si alguien introduce una
  dependencia dinámica (fail-fast: protege el presupuesto de performance).

### Diferencia con el placeholder actual (deuda a remover)

El `src/app/page.tsx` actual hace `await supabase.auth.getUser()` para
decidir el label del CTA ("Ir a tu inbox" vs "Entrar"). **Eso vuelve la
página dinámica** (lee cookies) y mata el prerender estático →
incompatible con el budget < 200ms.

**Decisión de la spec:** la landing pública NO chequea sesión en el
server. El CTA siempre apunta a `/login` (que ya redirige a un usuario
ya logueado hacia su inbox — ese branching vive en el flujo de auth, no
en la landing). Así la página queda 100% estática. Ver `content.md` §
CTA y la decisión D4 del README.

### Sin "streaming agresivo del shell"

El patrón de `docs/architecture.md` § "Streaming agresivo del shell"
(top-level await + `<Suspense>`) **NO aplica acá**: ese patrón es para
*pages de detalle con data*. La landing no tiene data → no hay nada que
streamear; se prerenderiza completa. Documentado explícitamente para que
nadie introduzca `<Suspense>`/skeletons innecesarios "por consistencia".

### Caching / CDN

- HTML estático con `Cache-Control` de Vercel para assets estáticos
  (immutable para `/_next/static/*`; el HTML del prerender se sirve desde
  el edge y se revalida en cada deploy porque `revalidate = false` →
  cambia solo al re-deployar).
- Sin `no-store`, sin `dynamic`. Cualquier cosa que fuerce SSR por
  request rompe el budget — el `force-static` lo previene.
- Fuentes: ya self-hosted por `next/font` (Google fonts descargadas en
  build, servidas desde el propio dominio con `font-display: swap` —
  configurado en `src/app/layout.tsx`). La landing **reutiliza** esas
  fuentes; **no agrega** webfonts externas (cero request a terceros, cero
  bloqueo de render).

## 4. Data

**CERO data dinámica.** La landing no consulta DB, no llama Supabase, no
lee headers ni cookies, no recibe `searchParams` que cambien el render.
Todo el contenido es estático en el código (copy en `content.md`,
materializado en los componentes de `_landing/`).

Esto es no-negociable para el budget: cualquier I/O en el path de render
del apex destruye el TTFB objetivo.

## 5. Boundaries (qué NO puede importar la landing)

- ❌ **No importa de `src/features/*`** (ni de sus `public.ts`). La
  landing no es consumidora del producto interno. Importar una feature
  arrastraría su árbol (queries, client components, RLS helpers) y
  reventaría el bundle/budget.
- ❌ **No importa Supabase / Prisma** (`@/shared/lib/supabase/*`,
  `@/shared/lib/prisma`). No hay data.
- ❌ **No usa `'use client'`** en componentes propios. Sin estado, sin
  efectos, sin handlers. Si una sección "necesita" interactividad,
  reconsiderar (probablemente no la necesita — la landing es estática por
  diseño de producto: "nada parpadea, nada grita").
- ✅ **Puede usar**: `next/link` (CTA), `next/image` (solo si D2 define
  hero image), las CSS vars/tokens de `globals.css` (ver `styles.md`),
  Tailwind para layout/spacing, las fuentes del root layout.
- ✅ **Puede leer `docs/landingpage/*`** como fuente de verdad del
  contenido y estilo.

## 6. Checklist de verificación (post-implementación, futuro)

Cuando se implemente (NO ahora):

1. `pnpm build` → la ruta `/` aparece como **`○ (Static)`** en el output
   de Next (no `ƒ (Dynamic)`). Si aparece dinámica, hay un I/O colado.
2. `ANALYZE=true pnpm build` → First Load JS de `/` = solo el shared
   runtime de Next (sin chunk propio de la landing).
3. Lighthouse en prod: Performance ≥ 99, CLS = 0, LCP < 800ms (ver
   budget en `README.md`).
4. `curl -sI https://<apex>/` → respuesta de CDN edge, sin
   `Cache-Control: private, no-store`.
5. Grep de boundary: ningún import desde `src/app/page.tsx` o
   `src/app/_landing/*` hacia `@/features/*`, `supabase`, `prisma`.
</content>
