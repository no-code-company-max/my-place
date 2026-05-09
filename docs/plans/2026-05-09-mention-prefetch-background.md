# Plan — Mention Prefetch Background

**Fecha:** 2026-05-09
**Predecesor inmediato:** Fase 1 perf (commits `bb2d369..1c6e9df`) + ADR `2026-05-08-sub-slice-cross-public.md` + ADR `2026-05-09-back-navigation-origin.md`
**Plan paralelo (compatible):** `docs/plans/2026-05-09-composer-mention-resolvers-refactor.md`
**Tipo:** Feature de performance UX — NO requiere ADR (no introduce paradigma; es housekeeping con un Provider).
**Estado:** Plan vigente — pendiente de ejecución por sub-fase.

---

## Context

El typeahead de mentions del slice `discussions/composers/` (4 wrappers: comment, post, event, library-item) tiene un **cold start de 300-500 ms** cuando el viewer typea por primera vez `@`, `/event` o `/library` en una sesión.

Causa medida: `MentionPlugin` (`src/features/rich-text/mentions/ui/mention-plugin.tsx:114-180`) ya tiene caches `cachedUsers/cachedEvents/cachedCategories` y dispara un prefetch en `useEffect` al mount. Pero ese mount ocurre cuando se monta el composer real (no el placeholder eager). En thread detail el composer es lazy (`comment-composer-lazy.tsx`), y en pages de creación (`/conversations/new`, `/library/.../new`, `/events/new`) el viewer puede typear el trigger dentro de los primeros 100-300 ms desde paint. Resultado: el prefetch corre en paralelo a la primera lectura del cache, y el cache está `null` cuando el plugin lo consulta → cae al `fetchOptionsForTrigger` live → RTT visible.

**Approach decidido (Approach 2):** mover el prefetch de "al mount del composer" a "al mount del shell `(gated)/layout.tsx`", dispararlo en `requestIdleCallback` post-FCP, persistirlo en memoria del cliente vía React Context, y que el `MentionPlugin` lea ese cache prioritariamente antes de su prefetch propio (que queda como fallback defensivo).

Approaches 1 (localStorage), 3 (Service Worker) y 4 (server-inject HTML) están explícitamente fuera de scope.

---

## Scope cerrado

### Entra

1. Crear un Provider Client `MentionPrefetchProvider` que vive dentro del slice `discussions/`, dispara las 3 Server Actions (`searchUsers('')`, `searchEvents('')`, `listCategories(placeId)`) en `requestIdleCallback` post-mount con timeout 2000ms (fallback `setTimeout(100)`), guarda los resultados en estado React, expone `useMentionPrefetch()` hook intra-slice, y re-fetchea cada 5 minutos cuando la tab está visible.
2. Envolver `<ZoneSwiper>{children}</ZoneSwiper>` en `(gated)/layout.tsx` con un Client wrapper que monta el Provider después de validar que `place + auth + open` pasaron. El layout sigue siendo Server Component; sólo se agrega un Client child mínimo que recibe `placeId` como prop.
3. Modificar el `MentionPlugin` para aceptar una **fuente externa de cache prefetcheado** vía un nuevo hook `useMentionPrefetch()` consumido condicionalmente: si está dentro del Provider, lee del Context; si no (renders fuera del shell, ej: un test isolated), cae al prefetch propio actual. Lógica de fallback intacta — defensiva.
4. Re-fetch automático cuando el viewer revisita la tab tras >5min ausente (`Page Visibility API` con timestamp), o por timer si la tab está siempre visible.
5. Test unitario del Provider (3 casos: dispara prefetch idle, no se ejecuta si la tab está hidden, refresca tras 5 min).
6. Smoke E2E mínimo: un thread detail abierto → typear `/library` < 100ms post-paint → menú aparece sin spinner perceptible.

### Fuera

- **localStorage / IndexedDB / cookies / Service Workers** (Approach 1, descartado).
- **Server-inject HTML del cache prefetcheado** (Approach 4, descartado).
- **Cualquier cambio en la API pública de `MentionPlugin`** (mantener back-compat con `MentionResolversForEditor` y `ComposerMentionResolvers`).
- **Cambiar el shape de `ComposerMentionResolvers`** o las 4 Server Actions (members/events/library).
- **Re-exportar el Provider o el hook desde `discussions/public.ts`** (intra-slice; ver D7).
- **Tocar archivos INTOCABLES** (ver § Salvaguardas).
- **Cualquier cambio en pages/specs de back navigation** (ADR `2026-05-09-back-navigation-origin.md` queda firme).
- **ADR**: este es feature de UX que respeta paradigma — sólo el plan en `docs/plans/`.
- **Reescribir `MentionPlugin`**: el cambio es chirúrgico (acepta cache externo).
- **Touch a `comment-composer-lazy.tsx`, `thread-presence-lazy.tsx`, `comment-realtime-appender.tsx`, `comment-thread-live.tsx`, `composers/public.ts`, `rich-text/composers/public.ts`, `rich-text/public.ts`, `back-origin.ts`, `back-button.tsx`** — Fase 1 + back navigation los dejaron en su forma final (excepción mínima en `composers/public.ts` aprobada en D11/M4: +1 línea para re-exportar el Provider).

---

## Decisiones cerradas

### D1 — Memoria del cliente vía React Context (NO localStorage / IndexedDB / cookies)

**Rationale.** localStorage agrega:

- Sincronización multi-tab (`storage` event handlers complejos).
- Invalidación cross-domain (¿cómo invalidar cuando `revalidateTag` server-side cambia datos?).
- Privacy/erasure: cualquier dato persistente requiere consideración del derecho al olvido a 365 días.
- TTL artesanal por entry.

Memoria de tab (Context) no tiene ninguno de esos costos. Vive el lifetime de la tab. Si el viewer cierra y vuelve, paga 1 prefetch idle de ~50-100ms en el background — invisible. Trade-off ganado.

**Consecuencia:** cada tab independiente. Si el viewer abre 3 tabs, 3 caches paralelos. Aceptable (los tabs son edge case y el costo neto es 3 × 1 prefetch idle por sesión).

### D2 — Ubicación del Provider y el hook: `src/features/discussions/composers/`

**Rationale.** Tres alternativas evaluadas:

| Ubicación                                                        | Pros                                                                    | Contras                                                                                                                                           | Veredicto   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `shared/lib/`                                                    | Compartido cross-slice                                                  | **VIOLA** boundary: importa de 3 slices ajenos (`members/public`, `events/public`, `library/public`). `shared/` no puede importar de `features/`. | Descartada  |
| `discussions/ui/`                                                | Cerca de los wrappers                                                   | Mezcla UI-core con la infra de composers; el sub-slice `composers/` ya existe y agrupa esa cohesión                                               | Descartada  |
| `discussions/composers/mention-prefetch-provider.tsx` (Provider) | Cohesión total — todo lo de "infra de composers" vive bajo `composers/` | Es la primera vez que el sub-slice gana un Context en vez de wrappers + hooks puros                                                               | **Elegida** |

El sub-slice `discussions/composers/` ya orquesta los 4 Composers Lexical y consume las 3 Server Actions cross-slice. Es el slice orquestador natural. El plan paralelo `composer-mention-resolvers-refactor.md` también va a meter `use-composer-mention-resolvers.ts` ahí — se refuerzan.

**Imports cross-slice del Provider** (todos vía barrel raíz `public.ts`, regla original del ADR `2026-05-08-sub-slice-cross-public.md`):

```ts
import { searchMembersByPlaceAction } from '@/features/members/public'
import { searchEventsByPlaceAction } from '@/features/events/public'
import { listLibraryCategoriesForMentionAction } from '@/features/library/public'
```

`tests/boundaries.test.ts` lo acepta sin cambios.

### D3 — Shape del Context

```ts
type MentionPrefetchValue = {
  users: MentionUserResult[] | null
  events: MentionEventResult[] | null
  categories: MentionLibraryCategoryResult[] | null
  /** Fuerza refresh manual (rara vez usado — los timers + visibility cubren el 99%). */
  refresh: () => Promise<void>
  /** Timestamp del último fetch exitoso (epoch ms). null si aún no terminó el primer prefetch. */
  lastFetchedAt: number | null
}

const MentionPrefetchContext = React.createContext<MentionPrefetchValue | null>(null)
```

Tipos importados desde `@/features/rich-text/public` (barrel lite, sin Lexical). `null` inicial es importante: el `MentionPlugin` distingue "no cache aún" (null) de "cache vacío legítimo" (array vacío).

`searchLibraryItems` **NO** se prefetchea — depende de `categorySlug` runtime. Igual que el comportamiento actual del plugin. El hook devuelve únicamente los 3 prefetcheables.

### D4 — Cuándo se dispara el prefetch (idle post-FCP)

`requestIdleCallback(cb, { timeout: 2000 })` con fallback `setTimeout(cb, 100)`. **Mismo patrón EXACTO que `thread-presence-lazy.tsx`** (líneas 50-67) — copy-paste structural. Justificación:

- No bloquea FCP / TTI / LCP del shell.
- 100ms de fallback es suficiente para garantizar que el viewer rara vez gana al prefetch (tipear el trigger en menos de 100ms post-paint requiere foco en composer + char inicial — improbable salvo en `/conversations/new` donde el composer es eager y autoFocus).
- Mismo timeout 2000ms que el resto del repo — consistencia.

### D5 — Re-fetch cada 5 min: `Visibility API` + timestamp, NO `setInterval` puro

**Rationale.** `setInterval(refresh, 5 * 60 * 1000)` consume recursos aunque la tab esté hidden (background tab → batería en mobile). Patrón mejor:

```ts
useEffect(() => {
  const TTL = 5 * 60 * 1000
  function maybeRefresh() {
    if (document.visibilityState !== 'visible') return
    const last = lastFetchedAtRef.current
    if (last !== null && Date.now() - last < TTL) return
    void doFetch() // updates state + lastFetchedAtRef
  }
  document.addEventListener('visibilitychange', maybeRefresh)
  // Soft timer: cada 60s comprueba si toca refrescar (sólo si visible).
  const interval = setInterval(maybeRefresh, 60 * 1000)
  return () => {
    document.removeEventListener('visibilitychange', maybeRefresh)
    clearInterval(interval)
  }
}, [])
```

Resultado:

- Tab visible 5 min → 1 refresh.
- Tab hidden 30 min, vuelve → 1 refresh inmediato al `visibilitychange`.
- Tab hidden indefinida → 0 refresh, 0 consumo.

### D6 — Provider en el layout: Client wrapper sobre Server Layout

`(gated)/layout.tsx` es un Server Component (lee `auth`, `place`, `perms` con Prisma). NO se convierte a Client. Patrón:

- **Nuevo archivo**: `src/features/discussions/composers/mention-prefetch-provider.tsx` (`'use client'`). Recibe `placeId` como prop. Renderiza `<MentionPrefetchContext.Provider value={...}>{children}</...>`.
- **Modificación mínima en `(gated)/layout.tsx`**: en la rama `status.open`, envolver `<ZoneSwiper>{children}</ZoneSwiper>` con `<MentionPrefetchProvider placeId={place.id}>...</...>`. ~3 líneas añadidas.

El Provider es Client; el layout sigue siendo Server. Mismo patrón que cualquier `<ThemeProvider>` o `<TooltipProvider>` de un layout Next App Router.

**Por qué dentro de `status.open`** y no en el branch de `PlaceClosedView`: si el place está cerrado, el viewer no compone nada. Cero motivo para prefetchear users/events/categories.

**Re-mount automático al cambiar de placeSlug:** el `(gated)/layout.tsx` está bajo `[placeSlug]/`, así que Next re-monta el árbol cuando el viewer navega a otro subdomain (`a.lvh.me` → `b.lvh.me` no comparten layout porque son hosts distintos; un cambio de slug interno reusa layout pero `placeId` cambia → el Provider invalida el cache vía dep `[placeId]` en su `useEffect` interno). Behaviour confirmado en el plan.

### D7 — `MentionPlugin` consume el Context con prioridad sobre su prefetch propio

**Rationale.** El plugin actual tiene tres niveles de cache (líneas 215-241):

1. `trySyncFromCache(trigger, caches)` — lee `cachedUsers/cachedEvents/cachedCategories` poblado por su `useEffect` propio.
2. Si cache `null` → `fetchOptionsForTrigger(trigger, composer)` live.

El cambio: el plugin gana **un nivel adicional ANTES** del paso 1:

```ts
// nuevo hook intra-sub-slice rich-text/mentions/
const externalCache = useMentionPrefetchSource()

// el useState legacy se mantiene; recibe seed inicial del Context si está disponible.
const [cachedUsers, setCachedUsers] = useState<MentionUserResult[] | null>(
  externalCache?.users ?? null,
)
// idem events, categories.

// cuando el Context emite nuevos valores (refresh), el plugin sincroniza.
useEffect(() => {
  if (externalCache?.users !== undefined && externalCache.users !== null) {
    setCachedUsers(externalCache.users)
  }
}, [externalCache?.users])
// idem events, categories.
```

**Defensa intacta:** si el Provider no está montado (testing isolated, page futura sin shell, etc.), `externalCache` es `null` → comportamiento legacy 100% preservado: el `useEffect` legacy del plugin sigue disparando su prefetch propio.

**Trade-off micro:** cuando ambos están activos (Provider sí + plugin propio sí) hay 2 prefetches paralelos por placeId. Los Server Actions ya cachean Prisma queries con `unstable_cache`. El costo neto es 1 hit extra al pooler — aceptable. Alternativa "desactivar el prefetch propio si externalCache existe" es opcional pero **rechazada** porque debilita la defensa: si el Provider entrega datos staleados de hace 5 min, el plugin propio refresca al primer mount en una sesión activa. Mejor mantener ambos, neutros.

### D7-bis — El Context vive en `rich-text/mentions/`, NO en `discussions/`

**Rationale revisado.** El consumer es `MentionPlugin`, en `rich-text/mentions/ui/`. El Provider que produce el cache es donde se ejecutan las 3 Server Actions cross-slice — pero el Provider y el Context **NO necesitan vivir juntos**. Patrón estándar React:

- **Context y hook consumer**: en `rich-text/mentions/ui/mention-prefetch-context.tsx`. Sólo declara el shape (tipos importados de `mention-plugin.tsx`) y exporta `MentionPrefetchContext` + `useMentionPrefetchSource()`. NO importa de ningún otro slice. Live en el slice del consumer.
- **Provider con la lógica de prefetch**: en `discussions/composers/mention-prefetch-provider.tsx`. Importa el Context desde `@/features/rich-text/mentions/public` (barrel del sub-slice mentions, que ya existe — confirmado en `src/features/rich-text/mentions/public.ts`). Importa las 3 Server Actions desde los 3 slices ajenos.

**Boundary check:**

- `discussions/composers/` importa de `rich-text/mentions/public` ✅ (barrel sub-slice cross-slice — regla del ADR `2026-05-08-sub-slice-cross-public.md`).
- `rich-text/mentions/` no importa de nadie nuevo ✅ (sólo declara el Context).
- `MentionPlugin` (en `rich-text/mentions/ui/mention-plugin.tsx`) lee el Context vía import relativo `./mention-prefetch-context` ✅ (intra-sub-slice).

**Superficie pública que se gana en `rich-text/mentions/public.ts`**: `MentionPrefetchContext`, `useMentionPrefetchSource()` y un type `MentionPrefetchValue`. Tres exports nuevos en un barrel ya existente. Mínimo overhead.

Este nivel de indirección es necesario por el boundary y cierra el caso. La complejidad agregada es de ~30 LOC en `rich-text/mentions/`.

### D8 — Error handling: degradación graceful per-trigger

Si `searchUsers('')` falla (red caída, action throw): el state `users` queda `null`, y cuando el viewer typea `@`, el plugin cae al fetch live (comportamiento legacy). Si el live también falla, el dropdown queda vacío. Mismo comportamiento UX que hoy — sin regresión.

Cada Server Action se invoca aislada con `.catch(() => {})` en el Provider, igual que el plugin actual (línea 156). Una falla no bloquea las otras dos.

### D9 — Re-fetch on mutation: TTL de 5 min basta (no `router.refresh` listening)

**Rationale.** La pregunta original: ¿si un admin crea/archiva una categoría mientras el viewer lee, el cache prefetcheado se invalida automáticamente?

Opciones evaluadas:

1. **Listen a `router.refresh`**: no hay API estable; `useRouter` no expone hooks de refresh.
2. **Visibility change forzando refresh**: ya lo hace D5 al volver post-5min.
3. **Hook al pathname change** (`usePathname`): re-fetch cada navegación. Costo: 1 fetch idle por navegación = excesivo (el cache no envejece en una nav).
4. **TTL 5 min puro**: el cache se refresca automático cada 5 min cuando la tab está visible. Ventana de stale máxima: 5 min. Para "admin agregó categoría hace 2 min" → el viewer la ve al cumplirse el TTL. Para casos super raros: el plugin tiene fallback al fetch live (que no usa cache) cuando typea con query no vacía. **Decisión: TTL 5 min basta**.

**Excepción**: si el viewer mismo (no otro admin) crea una categoría/evento en su tab (ej: `/library/[cat]/new` → publica), el redirect post-publish invoca `router.replace` → re-mount del shell `(gated)/layout.tsx` → el Provider no se re-monta (mismo placeId), pero al volver a la zona `/conversations` y abrir un composer, sigue viendo la categoría vieja durante hasta 5 min. Aceptable: mutaciones propias son menos frecuentes que las de otros admins, y cuando typea `/library/<query>` con query no vacía el plugin va al fetch live de igual forma. **No se agrega `refresh()` post-publish** — out of scope, complejidad cross-slice.

### D10 — Memoria por placeSlug: re-mount automático

Confirmado: `(gated)/layout.tsx` está bajo el segment `[placeSlug]`. Cuando el viewer cambia subdomain (= cambia host), el browser hace nav full-page → todo el árbol se re-monta y el Provider se re-instancia. Cuando navega entre paths internos del mismo place, el layout reusa, pero el `useEffect` interno del Provider tiene dep `[placeId]` — si por alguna razón cambiara, invalidaría todo. En la práctica `placeId` no cambia dentro de un mismo subdomain.

**Edge case cubierto**: si el viewer es admin de 2 places y navega entre tabs/ventanas, cada tab tiene su Provider con su `placeId`. No se mezclan caches.

### D11 — LOC y cohesión

| Archivo                                                                      | LOC estimado                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `rich-text/mentions/ui/mention-prefetch-context.tsx` (nuevo)                 | ≤40                                               |
| `rich-text/mentions/public.ts` (modificado)                                  | +3 LOC re-export                                  |
| `rich-text/mentions/ui/mention-plugin.tsx` (modificado)                      | +15 LOC (consumer del Context + sync `useEffect`) |
| `discussions/composers/mention-prefetch-provider.tsx` (nuevo)                | ≤120                                              |
| `discussions/composers/__tests__/mention-prefetch-provider.test.tsx` (nuevo) | ≤140                                              |
| `discussions/composers/public.ts` (modificado)                               | +1 LOC re-export del Provider                     |
| `app/[placeSlug]/(gated)/layout.tsx` (modificado)                            | +3 LOC                                            |

Total nuevo: ≤320 LOC. El feature `discussions/` no supera su excepción 1500 LOC + nueva carga (~120 + 140 + 1 = 261 LOC). El feature `rich-text/mentions/` (sub-slice) suma ~58 LOC — sigue holgado.

---

## Sub-fases

| Sub-id | Tema                                                                         | Sesiones              | Deliverable                                                                                        | Paralelizable                                                                                                               |
| ------ | ---------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **M1** | Context + hook consumer + re-export en `mentions/public.ts` (D7-bis)         | 1                     | `rich-text/mentions/ui/mention-prefetch-context.tsx` (nuevo) + edit `rich-text/mentions/public.ts` | NO con M3 (M3 lo importa)                                                                                                   |
| **M2** | Provider con prefetch + visibility + TTL (D2, D4, D5, D6, D8) + tests        | 1                     | `discussions/composers/mention-prefetch-provider.tsx` (nuevo) + test                               | NO con M1 (necesita su Context); SÍ con plan paralelo `composer-mention-resolvers-refactor.md` (touchea distintos archivos) |
| **M3** | Modificar `MentionPlugin` para consumir el Context con fallback intacto (D7) | 1                     | edit `rich-text/mentions/ui/mention-plugin.tsx`                                                    | NO con M1; SÍ con M2 si se splittea bien                                                                                    |
| **M4** | Mount el Provider en `(gated)/layout.tsx` (D6)                               | 1 (combinable con M2) | edit `app/[placeSlug]/(gated)/layout.tsx` + edit `discussions/composers/public.ts`                 | SÍ con M3 (archivos disjoint)                                                                                               |
| **M5** | E2E smoke + verificación final                                               | 1                     | spec nuevo o extender existente; ANALYZE ≤ baseline                                                | Secuencial post-M1-M4                                                                                                       |

**Total: 4-5 sesiones.**

### Orden de ejecución recomendado

1. **M1 primero** (es la dependencia hard de M2 y M3).
2. **M2 + M3 en paralelo** (archivos disjoint: M2 toca `discussions/composers/`; M3 toca `rich-text/mentions/ui/mention-plugin.tsx`). **Pre-condition del lead**: ambos agentes deben tener M1 mergeada antes de arrancar — el lead verifica `git log` antes de spawn.
3. **M4 secuencial** post-M2 (necesita el Provider exportado para importarlo en el layout).
4. **M5 al final**.

### Compatibilidad temporal con plan paralelo `composer-mention-resolvers-refactor.md`

Ambos planes tocan `discussions/composers/`. El plan de hook crea `use-composer-mention-resolvers.ts`; este plan crea `mention-prefetch-provider.tsx`. Archivos disjoint → **pueden ejecutarse en cualquier orden**. Si el plan paralelo va primero, este plan puede reutilizar el hook dentro del Provider (los 3 callbacks que el Provider arma para `searchUsers('')`, `searchEvents('')`, `listCategories()` son **idénticos** a los del hook — `useComposerMentionResolvers(placeId)` devuelve `searchUsers`, `searchEvents`, `listCategories`, `searchLibraryItems` ya memoizados). Si va después, este plan declara los 3 inline en el Provider y, cuando el plan paralelo se ejecute, su sesión H3 los unifica naturalmente migrando el Provider.

**Recomendación**: ejecutar el plan paralelo primero (es housekeeping puro, riesgo cero). Después este plan reutiliza el hook → menos LOC en el Provider.

---

## Critical files

### Archivos NUEVOS (por sub-fase)

#### M1

- `src/features/rich-text/mentions/ui/mention-prefetch-context.tsx` — declara `MentionPrefetchContext`, `useMentionPrefetchSource()` (`useContext` con `null` default), tipo `MentionPrefetchValue`. ≤40 LOC. `'use client'` directiva por `createContext`. NO importa de ningún otro slice.

#### M2

- `src/features/discussions/composers/mention-prefetch-provider.tsx` — `'use client'`. Recibe `{ placeId, children }`. Estado interno `users/events/categories/lastFetchedAt`. `useEffect` post-mount con `requestIdleCallback`/fallback. `useEffect` con `visibilitychange` + soft `setInterval(60s)` para el TTL 5min. Función `refresh()` expuesta. Renderiza `<MentionPrefetchContext.Provider value={...}>{children}</...>`. Imports cross-slice: `members/public`, `events/public`, `library/public`, `rich-text/mentions/public`. ≤120 LOC.
- `src/features/discussions/composers/__tests__/mention-prefetch-provider.test.tsx` — 3-4 casos: (a) dispara prefetch tras idle/timeout y popula state; (b) `lastFetchedAt` se setea tras prefetch exitoso; (c) `visibilitychange` post-5min refresca; (d) errores de actions no bloquean otros prefetches. Mockea las 3 Server Actions con `vi.mock`. ≤140 LOC.

### Archivos MODIFICADOS (por sub-fase)

#### M1

- `src/features/rich-text/mentions/public.ts` — agregar 3 exports: `MentionPrefetchContext`, `useMentionPrefetchSource`, `type MentionPrefetchValue`. +3 LOC.

#### M3

- `src/features/rich-text/mentions/ui/mention-plugin.tsx` — agregar al inicio del `MentionPlugin` componente: `const externalCache = useMentionPrefetchSource()`. Inicializar los 3 `useState` con `externalCache?.users ?? null` (idem events, categories). Agregar 3 `useEffect` que sincronizan `setCachedX` cuando `externalCache?.X` cambia. **NO TOCAR** el `useEffect` legacy del prefetch propio (líneas 150-180) — queda intacto como defensa. **NO TOCAR** `trySyncFromCache`, `fetchOptionsForTrigger`, ni el resto. +15 LOC. **Nota deuda pre-existente**: el archivo ya está sobre el cap 300 LOC. Este plan agrega 15 LOC más; no lo agrava significativamente. Posible follow-up split out-of-scope.

#### M4

- `src/app/[placeSlug]/(gated)/layout.tsx` — en la rama `status.open` envolver `<ZoneSwiper>{children}</ZoneSwiper>` con `<MentionPrefetchProvider placeId={place.id}>...</...>`. Import del Provider desde `@/features/discussions/composers/public` (barrel sub-slice — forma canónica). +3-4 LOC. Layout queda ≤85 LOC, holgado.
- `src/features/discussions/composers/public.ts` — re-exportar `MentionPrefetchProvider`. +1 LOC. La excepción del barrel sub-slice es razonable porque el Provider es Client liviano (sin Lexical). NO infringe Fase 1.

### Archivos NO MODIFICADOS (verificación explícita)

- `src/features/discussions/ui/comment-composer-lazy.tsx` — INTOCABLE.
- `src/features/discussions/ui/thread-presence-lazy.tsx` — INTOCABLE.
- `src/features/discussions/ui/comment-realtime-appender.tsx` — INTOCABLE.
- `src/features/discussions/ui/comment-thread-live.tsx` — INTOCABLE.
- `src/features/discussions/ui/comment-composer-form.tsx`, `post-composer-form.tsx`, `event-composer-form.tsx`, `library-item-composer-form.tsx` — el plan paralelo los toca; este plan NO.
- `src/features/discussions/public.ts` — INTOCABLE (sin nuevos exports).
- `src/features/rich-text/composers/public.ts` — INTOCABLE.
- `src/features/rich-text/public.ts` — INTOCABLE.
- `src/shared/lib/back-origin.ts` — INTOCABLE.
- `src/shared/ui/back-button.tsx` — INTOCABLE.
- Server Actions de `members/`, `events/`, `library/` — INTOCABLES.
- `tests/boundaries.test.ts` — sin cambios necesarios.

---

## Helpers / patterns reusados

- **Patrón `requestIdleCallback + setTimeout(100) fallback`**: copy-paste structural de `thread-presence-lazy.tsx` líneas 50-67. Mismo timeout, mismo cleanup.
- **Visibility API + soft interval**: patrón estándar React; el plan documenta el patrón canónico para el repo.
- **Context en una feature, Provider en otra**: precedente válido en repo (split client/server publics, sub-slice publics); el plan documenta el patrón explícitamente con D7-bis.
- **Server Actions importadas vía barrel `public.ts` cross-slice**: regla del ADR `2026-05-08-sub-slice-cross-public.md` original (no la extensión `<sub>/public`).
- **Sub-slice intra-`discussions/composers/`**: precedente del plan paralelo `composer-mention-resolvers-refactor.md`.
- **Tests con `renderHook` + `vi.mock` de actions**: precedente en `use-comment-realtime.test.tsx`.

---

## Riesgos + mitigaciones

| #   | Riesgo                                                                                                                             | Probabilidad          | Impacto                                                         | Mitigación                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | El Provider arrastra Lexical al bundle del shell                                                                                   | **Crítica si ocurre** | First Load del shell sube de ~218 kB a ~340 kB (regresa Fase 1) | El Provider importa Server Actions de members/events/library — esas actions NO traen Lexical (verificado: cada barrel `members/public.ts`, etc., expone Server Actions, no Composers). Verificar con `ANALYZE=true pnpm build`: el chunk del shell del `(gated)/layout.tsx` debe quedar ≤218 kB ± 1 kB. **Hard rollback trigger**. |
| R2  | El Provider arrastra Zod (la pieza Fase 2 F1 quiere sacar)                                                                         | Media                 | +35 kB en shell                                                 | Server Actions NO traen Zod al cliente (Next las wrappea). Verificable con ANALYZE. Si aparece, indica que algún `public.ts` mal hecho está re-exportando Zod schemas — escalar a Fase 2 F1.                                                                                                                                       |
| R3  | `useContext` con `null` default rompe los tests existentes del `MentionPlugin` que renderizan el plugin sin Provider               | Media                 | Suite roja                                                      | El hook `useMentionPrefetchSource()` retorna `null` cuando no hay Provider (no `throw`). El plugin tolera `null`. Verificación: correr `pnpm test --run src/features/rich-text/mentions/` antes y después de M3 — debe seguir verde.                                                                                               |
| R4  | `requestIdleCallback` no soportado en Safari iOS pre-18 → fallback a 100ms timeout pero el viewer ya typeó                         | Baja                  | Cold start preserved en Safari viejo                            | 100ms fallback es suficiente para el 99% de casos. Mismo comportamiento que `thread-presence-lazy.tsx` (precedente aceptado).                                                                                                                                                                                                      |
| R5  | El Provider re-fetch tras 5min falla por red caída → state queda con datos viejos                                                  | Baja                  | Cache stale más allá de 5 min hasta nueva visibilidad           | Aceptable. El plugin sigue cayendo al fetch live para queries no vacías. El user no ve diferencia con una sesión normal.                                                                                                                                                                                                           |
| R6  | Mocks de `vi.mock` en el test del Provider intentan importar Prisma                                                                | Media                 | Test no compila                                                 | Patrón de `composer-mention-resolvers-refactor.md` H1: `vi.mock` cada path con `vi.fn()` que retorna `Promise.resolve([])`. Sin Prisma.                                                                                                                                                                                            |
| R7  | El re-export del Provider desde `composers/public.ts` infla el bundle de pages que importan los 4 wrappers                         | Baja                  | <1 kB en pages de creación                                      | El Provider es ~120 LOC sin Lexical. ANALYZE confirma ≤2 kB de overhead. Aceptable.                                                                                                                                                                                                                                                |
| R8  | Memory leak del `setInterval` 60s si el Provider se desmonta sin cleanup                                                           | Baja                  | Memory creep                                                    | `useEffect` cleanup function obligatorio (`clearInterval`, `removeEventListener`). Test cubre el cleanup vía `unmount()` de `renderHook`.                                                                                                                                                                                          |
| R9  | Edge case: Provider se monta pero el viewer es admin del lugar cerrado y navega rápido a `/settings/hours` antes del idle callback | Muy baja              | Prefetch corre para nada (negligible)                           | No bloquea nada. El idle callback se cancela en cleanup; el fetch ya in-flight resuelve y descarta el result (active flag).                                                                                                                                                                                                        |
| R10 | El plan paralelo `composer-mention-resolvers-refactor.md` se ejecuta entre M1 y M4 → conflict en `composers/public.ts`             | Baja                  | Merge conflict trivial (ambos agregan exports distintos)        | Plan paralelo NO toca `composers/public.ts` (D7 explícito). Sin conflict.                                                                                                                                                                                                                                                          |
| R11 | `mention-plugin.tsx` ya está en ~605 LOC, este plan lo deja ~620 LOC, supera cap 300                                               | **Pre-existente**     | Cap violation pre-existing                                      | Documentar la deuda. NO se split en este plan (out-of-scope). Follow-up: split del plugin en archivos por trigger.                                                                                                                                                                                                                 |
| R12 | Smoke E2E del prefetch falla intermitente (idle no firea en CI rápido)                                                             | Media                 | E2E flaky                                                       | El test acepta que el prefetch puede no haber terminado en <100ms; el test sólo valida que typear `/library` con cache poblado no hace round-trip visible (medido vía network mock). Alternativa: no agregar E2E, dejar smoke manual en M5.                                                                                        |

---

## Verificación

### Por sub-fase

**M1 — Context + hook consumer**:

- `pnpm typecheck && pnpm lint`: verde.
- `pnpm test --run src/features/rich-text/mentions/`: verde (tests existentes intactos).
- `useMentionPrefetchSource()` retorna `null` cuando se llama fuera de Provider — verificable con un test trivial (≤20 LOC).

**M2 — Provider + tests**:

- `pnpm typecheck && pnpm lint`: verde.
- `pnpm test --run src/features/discussions/composers/__tests__/mention-prefetch-provider.test.tsx`: 3-4 casos verde.
- Comportamiento manual: en un page de prueba minimal (sin commit), montar el Provider y verificar en DevTools React que el state se popula tras ~100ms post-mount.

**M3 — Plugin consume Context**:

- `pnpm typecheck && pnpm lint`: verde.
- `pnpm test --run src/features/rich-text/mentions/`: verde (tests existentes deben tolerar `null` Context).
- LOC reportado de `mention-plugin.tsx` ≤620 (deuda pre-existente, no agravada significativamente).

**M4 — Layout mount**:

- `pnpm typecheck && pnpm lint`: verde.
- `ANALYZE=true pnpm build`: chunk del shell del `(gated)/layout.tsx` ≤218 kB (sin regresión Fase 1). **Hard gate**.
- Smoke manual: navegar a `/<placeSlug>/conversations`, abrir DevTools Network → tras ~100-200ms post-FCP verificar 3 requests fetched (`searchMembersByPlaceAction`, `searchEventsByPlaceAction`, `listLibraryCategoriesForMentionAction`). En reload de la misma tab tras 5 min: verificar que el `visibilitychange` dispara nuevo fetch.

**M5 — E2E + final**:

- `pnpm test --run`: end-to-end verde (suite completa ≥1949 tests).
- `ANALYZE=true pnpm build`: First Load JS de pages canónicas dentro de targets Fase 1 (≤238 kB lectura, ≤333 kB creación).
- Smoke manual completo:
  - Thread detail: tap "Sumate a la conversación" → editor lazy aparece → typear `/library` instant → menú aparece sin spinner perceptible (<50ms).
  - `/conversations/new`: typear `/event` instant después de paint → menú instant.
  - Tab cambio (5 min hidden, vuelve visible): DevTools Network muestra 3 fetches refresh.

### Final consolidada

| Métrica                                                     | Pre-plan   | Target post-plan                    |
| ----------------------------------------------------------- | ---------- | ----------------------------------- |
| Cold start typeahead `@` (primera vez por sesión, post-FCP) | 300-500 ms | <50 ms (cache warm)                 |
| First Load JS shell `(gated)/layout.tsx`                    | ~218 kB    | ≤220 kB (≤2 kB overhead aceptado)   |
| Re-fetch frequency tab visible 24/7                         | N/A        | 1 cada 5 min                        |
| Re-fetch frequency tab hidden                               | N/A        | 0                                   |
| Tests verdes                                                | 1949+      | 1953+ (4 tests nuevos del Provider) |

---

## Salvaguardas anti-regresión

### S1 — INTOCABLES verificados explícitamente

Los siguientes archivos NO se tocan. El lead verifica `git diff` antes de mergear cualquier sub-fase:

- `src/features/discussions/ui/comment-composer-lazy.tsx`
- `src/features/discussions/ui/thread-presence-lazy.tsx`
- `src/features/discussions/ui/comment-realtime-appender.tsx`
- `src/features/discussions/ui/comment-thread-live.tsx`
- `src/features/discussions/composers/public.ts` (excepción: M4 puede agregar 1 línea de re-export del Provider; aprobado en D11)
- `src/features/rich-text/composers/public.ts`
- `src/features/rich-text/public.ts`
- `src/shared/lib/back-origin.ts`
- `src/shared/ui/back-button.tsx`
- Los 4 wrappers `*-composer-form.tsx` (los toca el plan paralelo, no este).
- Las 4 Server Actions cross-slice.

`src/features/rich-text/mentions/ui/mention-plugin.tsx` SÍ se modifica (M3) — la lógica de fallback al prefetch propio + fetch live queda **intacta**.

### S2 — Ningún commit de Fase 1 perf se revierte

Los commits `bb2d369..1c6e9df` quedan firmes. El plan agrega; no resta. Si una sub-fase requiere modificar un archivo de Fase 1 distinto a `mention-plugin.tsx`, **STOP** y re-evaluar.

### S3 — Ningún commit de back navigation (`b87135f`) se revierte

ADR `2026-05-09-back-navigation-origin.md` queda firme. Layout NO modifica back logic.

### S4 — Tests existentes verdes pre y post

Pre-condition de cada sesión: `pnpm test --run` verde antes de modificar nada. Post-condition: idem. Si un test rompe, **rollback inmediato** + diagnóstico.

### S5 — ANALYZE bundle gate

Pre-condition de M4: capturar `ANALYZE=true pnpm build` output con First Load actual.
Post-condition: la nueva ANALYZE NO sube First Load del shell `(gated)` >2 kB.
Si sube >2 kB → revert M4, diagnosticar import contaminado.

### S6 — Test estático "Provider NO se importa eager desde shell crítico"

Después de M4, el Provider vive en `discussions/composers/`. El layout lo importa vía `discussions/composers/public.ts`. Salvaguarda: ningún archivo bajo `src/features/shell/`, `src/shared/`, ni cualquier page de lectura debe importar `MentionPrefetchProvider` directamente. Heurística test: `grep -rn "MentionPrefetchProvider" src/` debe retornar exclusivamente: el archivo del Provider, el `composers/public.ts`, el `(gated)/layout.tsx`, y el test del Provider. 4 hits máximo.

### S7 — Rollback triggers explícitos

- **M1**: si `useMentionPrefetchSource()` rompe alguno de los tests existentes del `MentionPlugin` (en `rich-text/mentions/__tests__/`) → revert.
- **M2**: si test del Provider falla con timeout (idle callback no firea en jsdom) → ajustar mock de `requestIdleCallback`/`document.visibilityState`. No revertir.
- **M3**: si suite de tests del plugin tarda >2× lo normal (señal de re-render storm) → revert + reanalizar identidad estable del Context value.
- **M4**: si First Load del shell sube >5 kB → revert inmediato.
- **M5 E2E**: si el smoke detecta typeahead vacío post-prefetch (cache no llega al plugin) → revert M3, reanalizar el flujo `useEffect` de sincronización.

### S8 — Comentario JSDoc en cada archivo nuevo blindando ubicación

- `mention-prefetch-context.tsx`: "Context vive en `rich-text/mentions/` porque el consumer (MentionPlugin) está acá. NO mover a `discussions/`: violaría el boundary `rich-text/` ↛ `discussions/`."
- `mention-prefetch-provider.tsx`: "Provider vive en `discussions/composers/` porque importa Server Actions de 3 slices ajenos (`members/public`, `events/public`, `library/public`). NO mover a `shared/` (boundary `shared/` ↛ `features/`)."

---

## Compatibilidad con plan paralelo (`composer-mention-resolvers-refactor.md`)

### Caso A: plan paralelo se ejecuta PRIMERO (recomendado)

El hook `useComposerMentionResolvers(placeId)` queda disponible en `discussions/composers/use-composer-mention-resolvers.ts`. El Provider de este plan (M2) lo reutiliza:

```ts
// dentro de mention-prefetch-provider.tsx
const resolvers = useComposerMentionResolvers(placeId)
// resolvers.searchUsers, resolvers.searchEvents, resolvers.listCategories
```

Beneficio: ~30 LOC menos en el Provider. Las 3 Server Actions se invocan via las callbacks memoizadas del hook (mismas refs). Bundle neutro.

### Caso B: este plan se ejecuta PRIMERO

El Provider declara las 3 callbacks inline (importing las 3 Server Actions directamente). Cuando el plan paralelo se ejecute (sesión H3 del plan paralelo), una sub-tarea adicional consiste en migrar el Provider a usar el hook. Cambio trivial (~5 LOC editadas), no rompe nada.

### Conflict potencial: ambos planes tocan `discussions/composers/`

Cero conflict de archivos:

- Este plan crea: `mention-prefetch-context.tsx` (en `rich-text/`), `mention-prefetch-provider.tsx`, test del provider.
- Plan paralelo crea: `use-composer-mention-resolvers.ts`, test del hook.
- Plan paralelo MODIFICA: los 4 `*-composer-form.tsx`.
- Este plan MODIFICA: `mention-plugin.tsx`, `(gated)/layout.tsx`, `mentions/public.ts`, `composers/public.ts` (+1 línea).

Archivos compartidos que ambos modifican: ninguno. Conflict-free.

### Pre-conditions del lead antes de spawnear agentes

1. Verificar que `git status` en main está limpio.
2. Verificar que ningún plan está mid-flight con commits a medias.
3. Capturar baseline: `pnpm build` First Load JS y archivar el output.
4. Capturar baseline: `pnpm test --run` count.
5. Si se spawnean los dos planes en paralelo:
   - Plan paralelo en agente 1 (toca `discussions/ui/*`).
   - Este plan M1 + M3 en agente 2 (toca `rich-text/mentions/`).
   - Este plan M2 + M4 en agente 3 secuencial post-M1 + post-plan-paralelo (toca `discussions/composers/`).

Si esa coreografía se siente frágil, **secuenciar**: plan paralelo primero, este plan después. Total 1 día más, riesgo cero.

---

## Alineación con CLAUDE.md y architecture.md

- [x] **LOC caps**: archivos nuevos ≤300 (Provider ≤120, Context ≤40, test ≤140); funciones ≤60 (la callback principal del Provider es un `useEffect` body ≤40 LOC).
- [x] **Feature size**: `discussions/` está bajo excepción explícita (gotcha CLAUDE.md). +260 LOC (Provider + test) deja el slice cerca del límite pero dentro de la excepción. `rich-text/mentions/` +55 LOC, holgado.
- [x] **Vertical slices**: `discussions/composers/` mantiene cohesión "infra de Composers"; `rich-text/mentions/` mantiene "todo lo del plugin". No se crea slice nuevo.
- [x] **Boundary rule**: el Provider está en `discussions/composers/`, importa Server Actions vía barrel raíz de members/events/library. El Context está en `rich-text/mentions/` (intra-sub-slice del consumer). `shared/` no toca features. `tests/boundaries.test.ts` queda intacto.
- [x] **`shared/` no importa de `features/`**: confirmado. Ningún archivo bajo `shared/` se modifica.
- [x] **Server Components por default**: el layout sigue Server. Solo el wrapper del Provider es Client (`createContext` lo requiere).
- [x] **Tipos estrictos, sin `any`**: el Context value tiene shape explícito; el hook retorna `MentionPrefetchValue | null`.
- [x] **Validación con Zod para input externo**: N/A. Las Server Actions ya validan en sus slices respectivos.
- [x] **Tailwind solo layout/spacing**: N/A — el Provider no renderiza UI visible.
- [x] **Spec-first**: este plan ES la spec. NO requiere `docs/features/` (no es feature de producto, es infra).
- [x] **NO ADR**: confirmado. Es housekeeping de UX dentro del paradigma existente. CLAUDE.md gotcha actualizado opcional (M5) si se descubre algo nuevo durante la implementación.
- [x] **Cozytech**: nada parpadea, nada grita. El prefetch es invisible. El typeahead pasa de "spinner 300ms" a "menú instant" — es justamente el patrón cozy.
- [x] **Una sesión = una cosa**: 5 sub-fases × 1 sesión cada una. Ninguna mezcla backend con frontend.
- [x] **TDD**: tests del Provider primero (M2), implementación después dentro de la misma sesión.
- [x] **Verificación auto**: cada sub-fase corre `pnpm typecheck && pnpm lint && pnpm test --run`. M4 + M5 corren ANALYZE.
- [x] **Idioma**: docs y commit messages en español; código en inglés (`MentionPrefetchProvider`, `useMentionPrefetchSource`, `lastFetchedAt`, etc.).
- [x] **Streaming agresivo del shell**: el layout sigue su patrón canónico (top-level await mínimo). El Provider Client child no bloquea el render — Provider Client wrappers no son `await`-able.

---

## Próximo paso

Ejecutar **M1 — Context + hook consumer + re-export** como primera unidad de trabajo. Es la dependencia hard de M2 y M3, baja LOC (≤45), riesgo mínimo. Una sesión focalizada cubre M1 + verificación. Después de M1 verde, lanzar M2 + M3 (en paralelo si el lead avala) y M4 + M5 secuencial.

Si el plan paralelo `composer-mention-resolvers-refactor.md` aún no corrió, ejecutarlo primero — riesgo cero, beneficio inmediato (M2 reutiliza su hook). Si ya corrió, este plan arranca directo en M1.
