# ADR — Introducción del shell común (R.2)

**Fecha**: 2026-04-26
**Estado**: Aprobado
**Sub-milestone**: R.2.0 (spec del shell)
**Referencias**: `docs/features/shell/spec.md`, `handoff/_shell/`,
`docs/multi-tenancy.md`, `docs/decisions/2026-04-27-design-handoff-rebrand.md`

## Contexto

Tras cerrar R.1 (migración visual a tokens del rebrand F.G), el
producto sigue siendo "islas": cada page del place (`/conversations`,
`/events`, `/settings`, `/`) renderiza su propio `<header>` con H1
local. No hay chrome común, no hay community switcher, no hay
indicador de "estás en la zona X".

El handoff `handoff/_shell/` define un shell mobile-first que cubre
estos gaps:

- TopBar con logo + community switcher pill + search trigger.
- Section dots como indicador de zonas.
- Section viewport para el contenido de cada zona.

Adoptarlo tal cual asume tres cosas que **conflictúan con la
arquitectura existente**:

1. **Routing path-based** (`/[community]/...`). El producto usa
   subdomain (`{slug}.{apexDomain}`).
2. **Swipe horizontal entre zonas** con query param `?s=N` y
   single-page que renderiza todas las zonas montadas. El producto
   usa rutas SSR separadas con Promise.all paralelizado por page
   (commits `144ce17`, `82ddbe7`, `e918526`).
3. **Status bar iOS cosmético** (47px con clock 9:41 + signal/wifi/
   battery). Decoración de prototipo Manus/Figma sin valor para una
   web app.

Adicionalmente, el handoff es **mobile-first** sin breakpoints
desktop. El producto es web (lvh.me, Vercel) — corre en cualquier
viewport.

## Decisiones

Se consultaron al user las 4 decisiones bloqueantes antes de
planear (CLAUDE.md "Sin libertad para decisiones arquitectónicas").

### Decisión 1 — Subdomain preservado

Mantener la arquitectura multi-tenant subdomain (`{slug}.{apexDomain}`).
El community switcher hace cross-subdomain navigation con
`window.location.assign('https://${slug}.${apexDomain}')`, NO
client-side `router.push`.

**Rationale**:

- El subdomain es source of truth de la identidad del place
  (memory feedback "URLs son subdominio" del user).
- El middleware multi-tenancy ya validado en producción (cookies
  cross-subdomain via apex domain, gates de auth, RLS por place).
- Refactor a path-based requeriría: nuevo middleware, refactor de
  todos los layouts, reescritura de cookies de sesión, cambio del
  modelo mental "una URL = un place". Inviable y sin valor agregado.

**Implicación**: el dropdown del switcher dispara una page reload
(`window.location.assign`), no SPA navigation. Aceptable porque el
cambio de community es infrecuente (pocas veces por sesión).

### Decisión 2 — Dots como links (R.2), swipe diferido (R.2.5)

Los section dots son `<Link>` a las URLs existentes (`/`,
`/conversations`, `/events`). Sin swipe horizontal en R.2.

**Rationale**:

- Preserva el critical path SSR optimizado en `144ce17`/`82ddbe7`/
  `e918526` (~50% reducción de tiempos). Cada zona sigue siendo SSR
  con su propio `Promise.all`.
- Compatible con el patrón Next.js App Router actual (file-based
  routing con `[placeSlug]` segment).
- El user reconoce que swipe es **core** para navegación mobile
  intuitiva — pero acepta dividir el trabajo: dots primero
  (pragmático), swipe como follow-up obligatorio.

**Follow-up obligatorio (R.2.5)**: swipe horizontal real entre zonas.
Refactor con framer-motion o react-swipeable. Single-page swipeable
vs SSR cross-page es una decisión arquitectónica que abre su propio
ADR cuando se planifique.

### Decisión 3 — Skip status bar iOS cosmético

NO construir la status bar de 47px con clock 9:41 + signal/wifi/
battery. Permanente skip.

**Rationale**:

- Es decoración del prototipo Manus/Figma para que los screenshots
  parezcan iOS. Sin valor real en web/PWA (el SO renderiza la status
  bar real cuando aplica).
- En desktop se ve raro (un mock de iPhone status bar centrado en
  Chrome).
- El user inicialmente confundió "status bar" con "menu funcional"
  (pensó que era la barra con search + community switcher). Aclarado:
  el "menu funcional" que el user quiere ES la TopBar (52px), ya en
  scope. Status bar cosmético = skip.

### Decisión 4 — Mobile-first con max-width centrado

Layout outer del shell: `max-w-[420px] mx-auto`. En desktop, el
contenido queda centrado con bordes laterales del background visibles.
Sin breakpoints custom (`md:`, `lg:`).

**Rationale**:

- El handoff es mobile-first sin breakpoints (asume viewport ~390px).
- Responsive completo (sidebar desktop, etc.) requiere diseño
  adicional fuera del handoff. Out of scope R.2.
- Mobile-only estricto (bloquear desktop con "abrí en mobile") es
  demasiado restrictivo — el producto debe funcionar en desktop
  aunque no esté optimizado.
- Pragmático: mobile-first con max-width preserva el feel del handoff
  sin agregar trabajo de breakpoints.

## Alternativas descartadas

1. **Routing path-based** (`/[community]/conversations`): refactor
   inviable, rompe la arquitectura validada. Decisión 1 explica.
2. **Swipe horizontal en R.2**: refactor mayor que rompe SSR
   paralelizado. Diferido a R.2.5.
3. **Tabs visibles tradicionales** (en vez de dots): menos minimalista
   que el handoff, no respeta la decisión de design.
4. **Responsive completo desktop** (sidebar, etc.): out of scope R.2.
   Si producto pide, abrir ADR separado con design adicional.
5. **Mobile-only estricto**: descartado por restrictivo.
6. **Mount del shell en `(gated)/layout.tsx`**: rompe `/settings/*`
   (que está fuera del gated route group). Mount en `[placeSlug]/
layout.tsx` (parent) cubre ambos.

## Implicaciones

- **Cleanup en R.2.3**: cada page tocada en R.1.B pierde su `<header>`
  con H1 duplicado ("Conversaciones", "Eventos", etc.). El nombre de
  la zona vive en el chrome ahora, no en cada page como "isla".
- **Performance**: la query del switcher (`listMyPlaces`) se agrega
  al `Promise.all` del parent layout. Mismo patrón validado.
- **Cookies cross-subdomain**: ya validadas en multi-tenancy. El
  switcher confía en apex domain cookie.
- **Pages sin shell**: `/login`, `/inbox`, marketing root, error
  boundaries. Cada uno conserva su propio layout local mínimo.

## Sub-fases R.2

- **R.2.0** (este doc + spec) — Aprobado.
- **R.2.1**: slice `src/features/shell/` con UI primitivos puros.
- **R.2.2**: mount en `[placeSlug]/layout.tsx`.
- **R.2.3**: cleanup de headers locales redundantes.
- **R.2.4** (opcional): E2E flow cross-subdomain.
- **R.2.5** (post, separado): swipe horizontal real con su propio ADR.

## Verificación

R.2.0 es spec-only. Sin código tocado. Verificación: lint pasa,
spec + ADR + roadmap están consistentes entre sí.
