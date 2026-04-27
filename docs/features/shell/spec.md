# Shell — Especificación

> **Alcance:** chrome común que envuelve todas las pages del place
> (gated y settings). TopBar (logo + community switcher + search
> trigger) + dots de zona + section viewport. Mobile-first con
> max-width centrado. Reemplaza los headers locales que cada page
> renderizaba como "isla".

> **Referencias:** `handoff/_shell/` (design canónico),
> `docs/multi-tenancy.md` (subdomain routing), `docs/theming.md`
> (tokens del rebrand F.G), `docs/decisions/2026-04-26-shell-introduction.md`
> (ADR con las 4 decisiones de arquitectura), `CLAUDE.md`
> (principios no negociables).

## 1. Modelo mental

El shell es **chrome común** a todas las pages del place — el primer
contenido que se ve al entrar a un place y la única navegación
persistente. Cumple tres funciones:

1. **Identidad contextual**: comunica "estás en el place X" via
   logo + nombre + color/avatar de la community.
2. **Navegación cross-zonas**: dots permiten saltar entre las zonas
   del place (Home / Conversations / Events / Library cuando exista).
3. **Switching cross-place**: el switcher abre un dropdown con la
   lista de places donde el viewer es miembro y permite saltar a
   otro sin volver al inbox.

NO es un layout más. NO renderiza data del place (posts, eventos,
miembros). Sólo orquesta navegación e identidad.

Comparación con paradigmas alternativos (descartados):

- **Sidebar desktop**: rompe el feel mobile-first del handoff. Si
  algún día queremos desktop nativo, sería un layout adicional, no
  reemplazo del shell.
- **Hamburger menu**: oculta navegación tras un click extra. El shell
  es navegación visible permanente — alineado con "presencia
  silenciosa pero accesible" (CLAUDE.md).
- **Tabs tradicionales**: visualmente más pesadas que los dots. El
  handoff prefiere dots por densidad visual baja.

## 2. Vocabulario

- **Shell**: el wrapper visual completo (TopBar + Dots + viewport).
- **TopBar**: barra superior 52px con logo + switcher + search.
- **Community switcher**: pill central de la TopBar que abre el
  dropdown de places. Vocabulario user-facing: "Tus comunidades".
  Internamente: `<CommunitySwitcher>` consume `MyPlace[]` (tipo ya
  existente en `places/public.ts`).
- **Section dots**: indicador de zonas debajo de la TopBar.
- **Zone**: cada sub-ruta principal del place (`/`, `/conversations`,
  `/events`). Mapea 1:1 con un dot. Library cuando exista (R.5
  diferida) suma el cuarto dot.
- **Active zone**: derivada del `pathname`, NO de query params.
- **Section viewport**: la región scroll bajo dots con `{children}`.

**Idioma**: UI en español, código en inglés. Mensajes al usuario:
"Tus comunidades", "Buscar", "Descubrir comunidades".

## 3. Propósito y scope

**Sí en R.2**:

- TopBar con logo, switcher, search trigger.
- Community switcher dropdown (cross-subdomain navigation).
- Section dots como links a las URLs existentes.
- Section viewport passthrough (sin swipe).
- Mount en `[placeSlug]/layout.tsx` (cubre gated + settings).

**No en R.2** (out of scope explícito):

- Swipe horizontal entre zonas → R.2.5 follow-up obligatorio.
- Status bar iOS cosmético (47px) → skip permanente, decoración sin valor.
- Onboarding overlay primera vez → Fase 7 separada.
- Persistencia "última zona visitada" cross-sesión → no se necesita
  con subdomain (la URL es source of truth).
- Search overlay funcional → R.4 separado.
- Library zone → diferida.
- `memberCount` en filas del switcher → follow-up.
- Custom domains (places fuera del apex) → asume `${slug}.${apexDomain}`.

## 4. Componentes y dimensiones

### TopBar (52px)

- Logo (36×36, `bg-surface`, border 0.5px `border-border`, radius 12)
  a la izquierda. Logo del producto, no del place.
- Community switcher pill al centro (flex-1, 36px alto, `bg-surface`
  border 0.5px). Avatar 22×22 + nombre + chevron.
- Search button (36×36 round-12, `bg-surface` border 0.5px) a la
  derecha. Icono `Search` lucide 18px.
- Border bottom 0.5px `border-border`.

### Dots (28px)

- 4 dots horizontales, gap 6px, centrados.
- Inactivo: 6×6px círculo `bg-dot` (token rebrand F.G).
- Activo: 18×6px pill `bg-text` (border-radius 999).
- Transición: `width 0.24s cubic-bezier(.3,.7,.4,1), background 0.2s`.
- Cada dot es `<Link>` de Next a la URL de su zona, con
  `aria-current="page"` en el activo.

### Section viewport

- `flex-1` con `{children}`. `overflow-x-hidden` (vertical libre, body
  scrollea — el cambio respecto al `overflow-hidden` original se hizo
  en R.6.4 para liberar `position: fixed/sticky` del CommentComposer
  del thread detail).
- Swipe horizontal real entre zonas: ver § 16 (R.2.5).
- Cada page child gestiona su propio scroll vertical interno.
- NO requiere `pt-[80px]` magic numbers (shell es static, no fixed).

### Layout root

```
<div className="mx-auto flex min-h-screen max-w-[420px] flex-col bg-bg">
  <TopBar ... />
  <SectionDots ... />
  <main className="flex-1 overflow-x-hidden">{children}</main>
</div>
```

Mobile-first centrado: en desktop el shell queda centrado con
máximo 420px de ancho. Bordes laterales del background quedan
expuestos (no full-bleed) — pragmático sin breakpoints custom.

## 5. Community switcher (dropdown modal)

### Trigger

Pill central de la TopBar. Click toggle el dropdown.

### Estados

`closed`, `opening`, `open`, `closing`. Manejado client-side con
`useState`.

### Posición

`fixed top-[52px] left-3 right-3` (justo debajo de la TopBar). Sin
status bar arriba, top start a 52px.

### Animación

- Transition `transform 0.22s cubic-bezier(.3,.7,.4,1), opacity 0.22s`.
- Open: `translateY(-12px → 0)` + `opacity (0 → 1)`.
- Close: inverso.
- Backdrop: `bg-black/30 fixed inset-0 z-40`. Tap cierra (no-op si
  click es dentro del dropdown panel).

### Lista

- Header: `TUS COMUNIDADES` (Inter 600, 11px, +0.6 tracking, uppercase,
  `text-muted`).
- Filas: avatar 38×38 (radius 10) + nombre + sub.
  - Avatar: `bg-{themeConfig.accent}` con initial Inter 600 / blanco /
    16px. La initial es el primer carácter del nombre del place.
  - Nombre: Inter 600 / 15px / -0.2 tracking. Trunca a `~180px` con
    ellipsis si no entra.
  - Sub: Inter 12px `text-muted`. R.2.1 muestra solo el rol
    (`Owner` / `Admin` / `Miembro`). Follow-up: agregar `· N miembros`
    cuando se extienda el query.
- Activa (current place): `bg-accent-soft` + check 20×20 round-full
  `bg-accent text-bg` con icono `Check` lucide 12px a la derecha.
- Footer: `+ Descubrir comunidades` placeholder no clickeable
  (`opacity-50`, `aria-disabled`). Diferido a Fase 8.

### Selección

```ts
function selectPlace(slug: string) {
  if (slug === currentSlug) {
    closeDropdown()
    return
  }
  // Cross-subdomain navigation. Cookie de sesión cross-subdomain ya
  // está validada (apex domain cookie). Va al "/" del nuevo place,
  // NO replica el path actual.
  window.location.assign(`https://${slug}.${apexDomain}`)
}
```

`apexDomain` viene de `clientEnv.NEXT_PUBLIC_APP_DOMAIN` (ya disponible).

## 6. Routing y data

### Data shape

`<AppShell>` recibe:

```ts
type AppShellProps = {
  places: MyPlace[] // de places/public.ts (listMyPlaces)
  currentSlug: string // de params.placeSlug
  pathname: string // de next/headers o usePathname
  children: React.ReactNode
}
```

### Query

La lista de places la fetcha el parent layout via `listMyPlaces(userId)`
ya disponible en `src/features/places/server/queries.ts:16`. El query
está cacheado por request via React.cache (mismo patrón identity-cache
del slice discussions).

**No requiere extender `places/` slice**. `MyPlace` ya incluye:

- `slug`, `name`, `themeConfig`, `archivedAt`
- `role` (MembershipRole)
- `isOwner`
- `joinedAt`

### Performance

La query se agrega al `Promise.all` del parent layout
(`[placeSlug]/layout.tsx`) junto a `getCurrentAuthUser()`,
`loadPlaceBySlug()`, `findMemberPermissions()`. Mismo patrón aplicado
en commits `144ce17`, `82ddbe7`, `e918526` — no bloquea critical path.

### Active zone derivation

```ts
function deriveActiveZone(pathname: string): ZoneIndex | null {
  if (pathname === '/' || pathname === `/${slug}`) return 0
  if (pathname.startsWith('/conversations')) return 1
  if (pathname.startsWith('/events')) return 2
  // Library cuando exista → 3
  return null // /settings/* y otros: ningún dot activo
}
```

`pathname` deriva de `next/headers` en Server Components o
`usePathname()` en Client. La constante `ZONES` en
`src/features/shell/domain/zones.ts` define el array canónico.

## 7. Z-index stacking

Orden completo del z-index del producto post-R.2:

| Capa                        | z-index | Notas                                  |
| --------------------------- | ------- | -------------------------------------- |
| Section viewport            | auto    | Default                                |
| Section dots                | 20      | Static, no overlap                     |
| TopBar                      | 30      | Static, no overlap                     |
| ZoneFab trigger (R.2.6)     | 30      | Fixed bottom-right, mismo nivel TopBar |
| Backdrop dropdown           | 40      | Fixed, full-bleed                      |
| Dropdown panel              | 41      | Fixed, sobre backdrop                  |
| Dialog (Radix)              | 50      | Modales del producto                   |
| FAB menu Portal (Radix)     | 50      | Vía DropdownMenuContent                |
| Toaster (sonner)            | 60      | Sobre todo                             |
| Search overlay (R.4 futuro) | 60      | Mismo nivel que toaster                |

## 8. Accesibilidad

- **Cada dot**: `<Link aria-label="Ir a Conversaciones" aria-current={active ? 'page' : undefined}>`.
- **Switcher trigger**: `<button aria-haspopup="menu" aria-expanded={open} aria-controls="community-dropdown">`.
- **Dropdown panel**: `<div role="menu" id="community-dropdown">` con
  focus trap (puede usarse Radix DropdownMenu si simplifica) + ESC
  cierra + click outside cierra.
- **Each row**: `<button role="menuitem" aria-current={isCurrent ? 'true' : undefined}>`.
- **Search trigger**: `<button aria-label="Buscar" aria-disabled="true" title="Próximamente">` en R.2; cambia a no-disabled en R.4.
- **Logo**: `<Link aria-label="Ir al inicio del producto" href="/">`
  (lleva al inbox del user en producción).
- **Backdrop**: NO `role="dialog"` porque el dropdown no es modal
  estricto — es un menú con scrim visual. Si el usuario clickea fuera,
  cierra.

## 9. Mobile-first + max-width centrado

- Layout outer: `max-w-[420px] mx-auto`. En desktop, contenido
  centrado con bordes laterales del `bg-bg` visibles.
- Dropdown: respeta el `max-w` del shell — `left-3 right-3` calcula
  desde el contenedor `max-w-[420px]`, no full-bleed en desktop.
- Sin breakpoints custom (`md:`, `lg:`). El shell es **mobile-first
  estricto** con tolerancia visual a desktop (no roto, pero sin
  rediseño).

## 10. Dónde se monta el shell (decisión arquitectónica)

**Mount en `src/app/[placeSlug]/layout.tsx`** (parent del gated route
group), NO en `(gated)/layout.tsx`.

**Razón**: settings (`/settings/*`) está fuera de `(gated)` por diseño
— admin/owner accede a settings con place cerrado. Si el shell
viviera en gated, el admin perdería el switcher al entrar a settings.
Mounting en el padre cubre ambos contextos.

**Lugares donde NO se monta**:

- `src/app/page.tsx` (marketing root)
- `src/app/login/*`
- `src/app/inbox/*` (no tiene `[placeSlug]`)
- `src/app/auth/*`, `src/app/invite/*`
- `src/app/not-found.tsx`, `src/app/error.tsx` (root boundaries)

**Compensación de altura**: shell es `static` (no fixed). Layout
outer es `flex flex-col min-h-screen`. Section viewport es
`flex-1 overflow-hidden` con scroll interno por page. El shell NO
tapa contenido; nada de `pt-[80px]` magic numbers.

**Place cerrado** (PlaceClosedView en gated): el shell SÍ se renderiza
porque está en el parent layout, fuera de gated. Comportamiento:

- Switcher funciona (puede saltar a otro place abierto).
- Dots renderizan deshabilitados (`opacity-50 pointer-events-none`)
  porque las zonas están bloqueadas.
- Search trigger queda visible pero stub (igual que en place abierto).

**`/m/[userId]` (member profile)**: dentro de `(gated)`, sí tiene
shell (heredado del parent layout). Ningún dot activo (no es zona).

## 11. Edge cases

- **User con 0 places activos**: caso defensivo (no debería pasar
  porque `[placeSlug]/layout.tsx` ya retorna 404 si no hay
  membership). Si llega de todos modos, switcher muestra solo el
  current place + footer "Descubrir comunidades" placeholder.
- **User con 1 place**: switcher se renderiza igual (con su único
  place + footer). NO se oculta — queremos consistencia visual del
  chrome.
- **User con N places (N > 10)**: dropdown scrollea verticalmente
  con `max-h-[60vh] overflow-y-auto`. Sin paginación (esperable: la
  mayoría de users tendrá <10 places).
- **Switcher selecciona el current place**: dropdown se cierra sin
  navegación (no-op).
- **Place cerrado en el target del switcher**: navegación procede;
  el `(gated)/layout.tsx` del nuevo place renderiza PlaceClosedView.
  Esperable y correcto.
- **Search trigger click en R.2**: NO hace nada (botón inerte). En
  R.4 conecta el overlay.
- **Pathname con trailing slash**: la derivación de active zone
  normaliza con `pathname.replace(/\/$/, '')`.

## 12. Principios no negociables aplicados (CLAUDE.md)

- **"Nada parpadea, nada grita"**: animaciones del dropdown suaves
  (cubic-bezier(.3,.7,.4,1) en 220ms). Sin spinners ni loading
  states agresivos al cambiar de community.
- **"Sin métricas vanidosas"**: el switcher muestra `{rol}`. NO
  muestra "última actividad", "thread más leído", "más activo esta
  semana".
- **"Sin urgencia artificial"**: search trigger SIN badge de unread,
  SIN dot rojo, SIN contador. Dots de zona SIN badges de novedad
  por zona (la novedad por post se sigue señalando en `PostCard`,
  no en el chrome).
- **"Sin gamificación"**: community switcher sin ranking, sin
  destacado "más activo".
- **"Identidad contextual"**: el current place se muestra como fila
  activa del dropdown (`bg-accent-soft` + check), NO se oculta.
  Comunica "estás acá" sin ocultar la opción de quedarse.
- **"Customización activa, no algorítmica"**: el orden de los places
  en el switcher es fijo (por `joinedAt asc`, ya garantizado por
  `listMyPlaces`). NO algoritmo de "recomendados".
- **"Presencia silenciosa"**: el shell NO tiene chat indicator, NO
  tiene "X usuarios online en el place". La presencia vive dentro de
  cada thread (`ThreadPresence`), no en el chrome.

## 13. Componentes UI (esqueleto)

```
src/features/shell/
├── public.ts                        → exports <AppShell>, types/zones
├── ui/
│   ├── app-shell.tsx                (root, recibe data + children)
│   ├── top-bar.tsx                  (logo + switcher pill + search)
│   ├── community-switcher.tsx       (dropdown + backdrop, 'use client')
│   ├── community-row.tsx            (fila individual del dropdown)
│   ├── section-dots.tsx             (4 dots con Link a URLs)
│   └── search-trigger.tsx           (stub button)
└── domain/
    └── zones.ts                     (ZONES const con label/path/index)
```

NO requiere `domain/types.ts` separado: `MyPlace` ya viene de
`places/public`. NO requiere `server/` (sin queries propias —
consume `listMyPlaces` via parent layout).

## 14. Tests

- `app-shell.test.tsx`: render con N places, current section
  derivada del pathname (mock `next/navigation`).
- `community-switcher.test.tsx`: open/close states, selección
  dispara navigation con URL correcta (mock `window.location.assign`).
  Click en current place es no-op.
- `community-row.test.tsx`: render activa vs no-activa, fallback de
  initial cuando nombre vacío.
- `section-dots.test.tsx`: dot activo según pathname, links
  correctos, ningún activo en `/settings/*`.
- `zones.test.ts`: derivación pure de pathname → zone index.
- E2E (`tests/e2e/flows/shell.spec.ts`): flow login → ver shell →
  cambiar de community → URL cambia de subdomain → shell del nuevo
  place renderiza. Validar también: sin shell en `/login` ni
  `/inbox`.

## 15. Sub-milestones de implementación (R.2.1+ — sesiones futuras)

- **R.2.1**: slice `src/features/shell/` con UI primitivos puros
  (sin data fetching, recibe props). Tests unit.
- **R.2.2**: mount en `[placeSlug]/layout.tsx` envolviendo
  `{children}`. Layout fetcha `listMyPlaces` en su Promise.all
  (junto a auth + place + perms).
- **R.2.3**: cleanup de headers locales redundantes en pages —
  cada page tocada en R.1.B pierde su `<header>` con H1
  ("Conversaciones", "Eventos", etc.) duplicado. El nombre de la
  zona vive en el chrome ahora, no en cada page.
- **R.2.4** (opcional): test E2E del flow completo cross-subdomain.
- **R.2.5**: swipe horizontal real entre zonas. Spec completa en § 16
  - ADR `docs/decisions/2026-04-26-zone-swiper.md`. Sub-fases R.2.5.0
    → R.2.5.5.

## 16. Swipe horizontal entre zonas (R.2.5)

> Agregado el 2026-04-26. Documenta el rediseño del navegador entre
> zonas: dejar de ser `<Link>` puro (skeleton + cross-page nav) para
> ser un swipe gesture nativo + transición fluida sin skeleton.
> Decisiones formalizadas en ADR
> `docs/decisions/2026-04-26-zone-swiper.md`.

### 16.1 Objetivos

1. **Production-robust** — gesture handling con librería madura
   (framer-motion@^11), sin reinventar touch events.
2. **Reactivo** — al cambiar de zona, ver contenido fresco; sin
   quedarse con datos cacheados de hace minutos.
3. **Fluido como app, sin skeleton** — la transición debe sentirse
   instantánea; el `loading.tsx` actual rompe la sensación de "una
   sola app".
4. **Sin desperdicio de bandwidth** — no refresh-on-every-swipe ni
   Realtime per-zona (queda follow-up post-R.2.5).

### 16.2 Modelo de routing — route-based + swiper wrapper

NO se usan parallel routes (sub-pages como
`/conversations/[postSlug]` rompen el modelo + library R.5 escala
mal). Cada zona conserva su URL canónica (`/`, `/conversations`,
`/events`). El swiper es un Client Component que envuelve `{children}`
y maneja gesture + transición. Cuando el swipe completa, dispara
`router.push(targetUrl, { scroll: false })`.

```
src/app/[placeSlug]/(gated)/layout.tsx
  ├── hard gate (PlaceClosedView)
  └── <ZoneSwiper>
       └── {children}    ← contenido SSR de la zona actual
```

Mounting **solo en `(gated)/layout.tsx`**, no en
`[placeSlug]/layout.tsx`. Settings no es zona del producto — es
panel admin paralelo. Swipe entre `/settings/hours` y `/conversations`
sería confuso UX.

### 16.3 Componente `<ZoneSwiper>`

Vive en `src/features/shell/ui/zone-swiper.tsx`. Reusa
`deriveActiveZone(pathname)` ya existente en `shell/domain/zones.ts`.

**Comportamiento del gesture** (framer-motion):

- `<motion.div drag="x" dragConstraints={...} dragElastic={0.2}
onDragEnd={...}>`.
- Threshold de snap: 40% del ancho viewport, o velocity > 500 px/s.
- `dragElastic={0.2}` da el bounce visual en bordes (zone 0 hacia
  izq, zone 2 hacia der) sin permitir snap fuera de rango.
- Transición de snap: spring `stiffness: 350, damping: 35` — natural
  y rápido sin overshoot exagerado (alineado con cozytech tranquilo).
- Durante el drag, el viewport translate3d el `<children>` actual;
  zonas adyacentes NO se renderizan en DOM (solo el current).

**Pass-through** (cuando NO actuar):

- Sub-pages (`/conversations/[postSlug]`, `/events/[id]`,
  `/m/[userId]`, `/conversations/new`, etc.): `deriveActiveZone()`
  retorna `null` → swiper retorna `<>{children}</>` sin envolver.
- `/settings/*`: el swiper ni siquiera se monta (vive en
  `(gated)/layout`, settings es sibling).
- PlaceClosedView: `(gated)/layout` retorna directamente
  `<PlaceClosedView>` antes de alcanzar el swiper.

### 16.4 Estrategia de loading state (skeletons)

**Diseño post-R.2.5.2-fix**: skeletons explícitos via `loading.tsx`
por zona root.

> **Nota de pivote (R.2.5.2-fix, 2026-04-26)**: el plan original
> R.2.5.0 proponía eliminar `loading.tsx` y usar `startTransition` +
> `<TopProgressBar>` para "mantener UI viejo hasta que el nuevo
> esté listo". En la primera prueba manual con datos reales (dev
> mode + Supabase pgbouncer high-latency) se observaron dos issues
> coupled: (a) el dot activo de SectionDots NO actualizaba al snap
> porque `usePathname()` queda en valor viejo durante transition;
> (b) sin skeleton, la pantalla quedó frozen 4-12 segundos
> esperando que el RSC completara. Ambos issues se resuelven
> quitando `startTransition` del swiper y restaurando los
> skeletons. Skeletons son production-honest — comunican "la app
> está trabajando" sin mentir sobre el tiempo. Decisión 6 del ADR
> invertida; ver `docs/decisions/2026-04-26-zone-swiper.md`.

**Componentes del flow actual**:

1. **Prefetch on pan start** (`zone-swiper.tsx`):
   `onPanStart` dispara `router.prefetch(adjacentZonePath)` para
   warmear cache de vecinos. Reduce skeleton time si el snap
   completa.
2. **`router.push` directo (sin `startTransition`)** — `usePathname()`
   actualiza inmediato cuando el push se procesa, así el dot activo
   de `<SectionDots>` se sincroniza con el snap visual del swiper.
3. **`loading.tsx` por zona root** (`/`, `/conversations`,
   `/events`): skeleton estructural acorde al handoff F.G,
   bloques `bg-soft` quietos sin animaciones ruidosas. Renderiza
   DENTRO del swiper viewport — el swiper resetea su transform a
   `x=0` vía `useLayoutEffect` cuando `activeIndex` cambia, así el
   skeleton aparece en posición correcta sin flash de off-screen.
4. **Sub-pages mantienen su `loading.tsx`** intacto — el swiper no
   actúa ahí, navegación es full-page con skeleton normal
   (precedente: thread detail R.6.4).

**Resultado UX**: drag → snap animation completa → en el instante
del snap el dot actualiza Y el skeleton aparece DENTRO del swiper
(sin gap visual) → contenido real reemplaza al skeleton cuando RSC
streamea. La fluidez del gesture sigue siendo "app-like"; el
loading state es honesto sobre el tiempo de fetch.

### 16.5 Reactividad sin desperdicio (Next 15 staleTimes)

**⚠ Gap crítico de Next 15**: el default de route cache (RSC payload)
para rutas dinámicas pasó de 30s (Next 14) a **0s (Next 15)**. Sin
configuración explícita, cada navegación re-fetcha — defeats el
"fluido" goal. Estáticas siguen en 5 minutos.

**Configuración requerida en `next.config.ts`** (R.2.5.2):

```ts
experimental: {
  staleTimes: {
    dynamic: 30,   // 30s — opt-in al comportamiento Next 14
    static: 180,   // 3 min para estáticas (default Next 15: 5)
  },
}
```

Validar antes de adoptar: en R.2.5.1, antes de tocar config,
instrumentar el swiper con `console.log` para confirmar el
comportamiento actual del cache. Si `experimental.staleTimes` no es
estable en la versión exacta de Next que usamos (15.5.15), evaluar
fallback `revalidate: 30` exportado por cada page de zona.

**Refuerzo manual: `router.refresh()` condicional**:

- El swiper trackea `lastVisitedAt[zone]` en un Map en useRef.
- Cuando el snap completa, comparar `Date.now() - lastVisitedAt[zone]`.
- Si > 30s → `router.refresh()` post-push (forza re-render aunque
  cache esté warm, garantiza datos fresh).
- Si ≤ 30s → confiar en route cache + lo que SSR ya entregó.

**Bandwidth/cost analysis** (place de 150 members, asumiendo
`staleTimes.dynamic: 30`):

- ~70% de los swipes (rapid hopping) son cache hits, cero queries.
- 30% restantes hacen 1 RSC request.
- Net: **menos load que hoy** (la skeleton actual ya implica full
  RSC fetch en cada nav).

**Realtime per-zona DIFERIDO**: 5K mensajes WS extra/place no se
justifican en R.2.5. Si producto pide updates push-based al ver
contenido nuevo de otros members en vivo dentro de la lista, se
agrega como follow-up con su propio ADR.

### 16.6 Per-zona scroll position

**Problema**: con `scroll: false`, Next NO scrollea al cambiar de
ruta. Si user scrolleó deep en `/conversations` y swipea a `/events`,
la nueva page renderea al MISMO scrollY (no 0). UX rota.

**Solución**: `<ZoneSwiper>` mantiene un `scrollByZone:
Map<ZoneIndex, number>` en useRef:

- En `onSnap` (justo antes de `router.push`): guardar `window.scrollY`
  en `scrollByZone[currentZone]`.
- Después del push (en `useEffect` que reacciona al cambio de
  `pathname`): leer `scrollByZone[newZone] ?? 0` y `window.scrollTo(0,
scrollY)`.
- Reset al volver al place: el ref se re-inicializa al desmontar el
  swiper (cambio cross-place).

Patrón estándar en SPAs (Twitter, Instagram tabs).

### 16.7 Accesibilidad

- **`prefers-reduced-motion`**: si el user tiene esta preferencia
  activa, el swipe sigue funcionando (gesture válido) pero la spring
  animation se reemplaza por una transition lineal de 0ms — snap
  instantáneo. framer-motion respeta esto via `useReducedMotion()`.
- **Keyboard**: dots siguen siendo `<Link>` accesibles via Tab.
  Arrow keys (←/→) NO se mapean a swipe en R.2.5 — los dots ya
  cubren keyboard nav.
- **`aria-current="page"`** en el dot activo se mantiene (R.2.1 ya
  lo tiene). El swiper no afecta esto.
- **Lectores de pantalla**: el swipe gesture no anuncia cambio de
  zona; la URL change + `<title>` per-zona ya lo señalan al lector.
- **`touch-action: pan-y`** en el viewport del swiper: bloquea
  browser back-gesture (iOS Safari swipe edge) y scroll horizontal
  nativo. `overscroll-behavior-x: contain` adicional para prevenir
  pull-to-refresh side-effects en Chrome Android.

### 16.8 Robustez de producción

- **Error boundary**: el `<ZoneSwiper>` se envuelve en un React Error
  Boundary que, si framer-motion crashea o el snap falla, degrada a
  pass-through `{children}` + log via pino. Los dots Link siguen
  funcionando. Cero downtime UX.
- **Bundle size impact**: framer-motion ~30KB gz. Validar en R.2.5.1
  con `pnpm build` + comparar bundle antes/después; si el delta es
  > 10% del First Load JS, evaluar dynamic import del swiper.
- **`framer-motion@^11`**: pinear major version explícitamente. APIs
  cambiaron entre v10 y v11.

### 16.9 Componentes nuevos / modificados

**Nuevos**:

- `<ZoneSwiper>` en `src/features/shell/ui/zone-swiper.tsx` (Client).
- `<SwiperViewport>` en `src/features/shell/ui/swiper-viewport.tsx`
  (Client interno, framer-motion).
- `<TopProgressBar>` en `src/shared/ui/top-progress-bar.tsx`
  (Client, primitivo agnóstico reusable). **Deprecated para R.2.5**
  tras pivote post-prueba (ver § 16.4); el componente persiste para
  futuros callers.
- `loading.tsx` skeletons:
  - `src/app/[placeSlug]/(gated)/conversations/loading.tsx` (restaurado
    R.2.5.2-fix tras eliminación temporal en R.2.5.2).
  - `src/app/[placeSlug]/(gated)/events/loading.tsx` (nuevo
    R.2.5.2-fix).

**Modificados**:

- `src/app/[placeSlug]/(gated)/layout.tsx`: envolver `{children}`
  con `<ZoneSwiper>`.
- `src/features/shell/ui/section-dots.tsx`: agregar
  `onMouseEnter`/`onFocus` con `router.prefetch` (R.2.5.3).
- `src/features/shell/public.ts`: export `<ZoneSwiper>`.
- `next.config.ts`: agregar `experimental.staleTimes`.

**Eliminados** (versión R.2.5.0 del plan, revertido en R.2.5.2-fix):

- ~~`src/app/[placeSlug]/(gated)/conversations/loading.tsx`~~ —
  restaurado.
- ~~`src/app/[placeSlug]/(gated)/events/loading.tsx`~~ — agregado.

### 16.10 Sub-fases de implementación (R.2.5.0 → R.2.5.5)

| Sub         | Deliverable                                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R.2.5.0** | Spec § 16 (este doc, MOD) + ADR (NEW) + roadmap (MOD).                                                                                                                                                      |
| **R.2.5.1** | `pnpm add framer-motion@^11`. Crear componentes nuevos + tests unit (snap derivation, prefetch wiring, lastVisitedAt, scrollByZone). Gesture testing diferido a Playwright (R.2.5.4). Validar bundle delta. |
| **R.2.5.2** | Configurar `experimental.staleTimes` (validar antes en dev). Mount `<ZoneSwiper>` en `(gated)/layout`. Remover `loading.tsx` de zonas root.                                                                 |
| **R.2.5.3** | Prefetch on dot focus/hover (modificación section-dots) + `lastVisitedAt` cache + `router.refresh()` condicional al snap. Per-zona scroll preservation.                                                     |
| **R.2.5.4** | E2E Playwright `zone-swipe.spec.ts` (touch.dispatch\* events) + manual QA en mobile real (iOS Safari + Chrome Android) + ajustes de spring config + edge cases.                                             |
| **R.2.5.5** | Cleanup + docs + spec § 16 actualizado con realidad implementada + roadmap R.2.5 ✅ + memory feedback si aplica.                                                                                            |

### 16.11 Excepciones (NO migrar al modelo literal del handoff)

- **No share button entre zonas**: SKIP, fuera de scope F1.
- **No haptic feedback**: SKIP. Cozytech tranquilo, sin vibración.
- **No sound effects**: SKIP. "Presencia silenciosa".
- **No "swipe hint"** animation al primer mount: SKIP. Sin grito visual.
- **Dot hover prefetch en mobile**: el `onMouseEnter` no dispara en
  touch — solo en desktop. En mobile, el prefetch de vecinos vive en
  `onPanStart` del swiper (mismo efecto, momento distinto).

## 17. FAB cross-zona con menú contextual (R.2.6)

> Agregado el 2026-04-26. Implementa el follow-up FAB anotado en
> `docs/features/discussions/spec.md` § 21.8: reemplaza las CTAs
> "Nueva" embebidas en los headers de zona por un único botón
> flotante en el shell con menú contextual. Decisiones formalizadas
> en ADR `docs/decisions/2026-04-26-zone-fab.md`.

### 17.1 Objetivos

1. **Punto único de entrada para crear** — antes había "Nueva" en
   threads header y "Proponer evento" en events header (CTAs
   dispersos). Ahora un solo botón cross-zona.
2. **Escalable a acciones futuras** — perfil, settings,
   compartir, etc. (esto último es follow-up; MVP solo crear).
3. **Production-robust** — Radix DropdownMenu maduro (focus trap +
   ARIA + ESC + Portal); zero atajos.
4. **Cozytech** — sin pulse, sin badges, sin urgencia. Sombra sutil
   alineada con `<PageIcon>`.

### 17.2 Arquitectura — 2 capas

**`<FAB>` en `src/shared/ui/fab.tsx`** — primitivo agnóstico al
dominio. Recibe `icon`, `triggerLabel` (aria) y `children` (items
del menú). NO conoce zonas, places, ni rutas. Mismo nivel que
`<Avatar>`, `<BackButton>`, `<TopProgressBar>`.

**`<ZoneFab>` en `src/features/shell/ui/zone-fab.tsx`** — Client
Component orquestador. Lee `pathname`, decide visibilidad
(`isZoneRootPath` reusado de `swiper-snap.ts`), arma items con paths
hardcoded MVP (`/conversations/new`, `/events/new`). Wrappea
`<FAB>`. Single responsibility: traducir contexto del shell a
acciones del FAB.

**NO se crea `src/features/actions/` slice** (anotado en § 21.8 como
aspiracional pero overhead sin tracción para 2 acciones). Diferir
registry pattern a Library R.5 (cuando sumen zonas + acciones
dinámicas por permiso).

**Boundary check**: `zone-fab.tsx` NO importa de `discussions` ni
`events` slices — los paths son strings literales (no type imports).
Cero violación de aislamiento.

### 17.3 Specs visuales

- **Tamaño**: 56×56 (`h-14 w-14`), `rounded-full`.
- **Background**: `bg-surface` — NO accent. Alineado con "presencia
  silenciosa", no grita atención.
- **Border**: `0.5px border` (mismo border-radius/border que
  `<PageIcon>`).
- **Sombra**: dual sutil — `0 4px 14px rgba(0,0,0,0.06), 0 1px 2px
rgba(0,0,0,0.04)` (idéntica a `<PageIcon>` para consistencia).
- **Icono**: `Sparkles` lucide 20px, `text-text` (full opacity).
- **Hover**: `bg-soft` suave; `motion-safe:transition-colors`.
- **Focus**: ring accent (a11y).
- **Sin animación de entrada**, sin pulse, sin badges, sin
  contadores.

### 17.4 Posicionamiento — alineado a la columna del shell

**Problema** (gap descubierto en audit): `fixed bottom-6 right-3`
ancla a la viewport, NO a la columna `max-w-[420px] mx-auto` del
shell. En desktop el FAB queda flotando en el espacio negativo a la
derecha de la columna.

**Solución**: wrapper de 2 niveles que mirrors la columna:

```tsx
<div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
  <div className="pointer-events-none relative w-full max-w-[420px]">
    <button
      className="pointer-events-auto absolute bottom-6 right-3 ..."
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
      ...
    >
      {icon}
    </button>
  </div>
</div>
```

`pointer-events-none` en el wrapper para no bloquear interacciones
del shell por debajo; el botón captura clicks vía `pointer-events-auto`.

`safe-area-inset-bottom` para iOS notch / home bar.

### 17.5 Visibilidad

- **Solo zonas root** (`/`, `/conversations`, `/events`) — vía
  `isZoneRootPath(pathname, ZONE_PATHS)` (reusa la utility del
  swiper).
- **NO en sub-pages** (thread detail, event detail, /m/, new forms).
- **NO en `/settings/*`** — el FAB se monta en `(gated)/layout.tsx`,
  settings está fuera del gated.
- **NO cuando place cerrado** — `(gated)/layout.tsx` retorna
  `<PlaceClosedView>` antes de mountar el swiper + FAB.

### 17.6 Menú — items MVP

Mismo set en las 3 zonas (no zona-aware en MVP — costo cognitivo de
"el menú cambia según donde estoy" supera el beneficio para una app
de 150 members):

```tsx
<FAB icon={<Sparkles size={20} aria-hidden />} triggerLabel="Acciones">
  <DropdownMenuItem asChild>
    <Link href="/conversations/new">Nueva discusión</Link>
  </DropdownMenuItem>
  <DropdownMenuItem asChild>
    <Link href="/events/new">Proponer evento</Link>
  </DropdownMenuItem>
</FAB>
```

Vocabulario "Nueva discusión" matching la wording del user en su
solicitud + section header "Discusiones". Existe inconsistencia
producto-wide entre "conversaciones" (dot label) y "discusiones"
(section header) — unificación queda como follow-up de producto.

### 17.7 Accesibilidad

- **`aria-label="Acciones"`** en el trigger.
- **Keyboard navigation** (Radix nativo): Tab al FAB, Enter abre,
  Arrow keys navegan items, Enter activa, Escape cierra y focus
  vuelve al trigger.
- **`prefers-reduced-motion`**: Radix respeta nativo via
  `data-[state=open]:animate-in data-[state=closed]:animate-out`.
- **Items son `<Link>` semánticos** dentro de `<DropdownMenuItem
asChild>` — no `<div onClick>`. URL canónica preservada.
- **Portal mount** en `document.body` — no bloqueado por overflow
  del shell viewport.

### 17.8 Z-index (ver § 7 actualizado)

- Trigger FAB: **z-30** (mismo nivel que TopBar; ambos `fixed` en
  posiciones distintas, sin colisión visual).
- Menú abierto: z-50 vía `DropdownMenuContent` Portal — arriba de
  Dialog (z-50, mismo nivel; conviven sin overlap por context).
- Toaster (z-60) sigue por encima de todo.

### 17.9 Conflictos potenciales y mitigaciones

- **CommentComposer** del thread detail (R.6.4) está `fixed bottom-0
z-30`. Sin colisión: composer solo en sub-pages (`/conversations/
[postSlug]`), FAB solo en zona roots — son mutuamente exclusivos.
- **Sonner Toaster** (`position="bottom-right"` z-60): puede cubrir
  el FAB visualmente cuando aparece un toast. Funcionalmente OK
  (toast captura clicks durante 4s; FAB sigue tappable después).
  UX subóptima si overlap exacto. Mitigación diferida a manual QA
  R.2.6.3 — opciones: mover toaster a `top-right` (cambio en
  `toaster.tsx`) o subir FAB a `bottom-24`.
- **PlaceClosedView**: cubierto por mount strategy, no monta.

### 17.10 Componentes nuevos / modificados

**Nuevos**:

- `src/shared/ui/fab.tsx` (primitivo).
- `src/features/shell/ui/zone-fab.tsx` (orquestador).
- Tests: `src/shared/ui/__tests__/fab.test.tsx` +
  `src/features/shell/__tests__/zone-fab.test.tsx`.

**Modificados**:

- `src/app/[placeSlug]/(gated)/layout.tsx`: mount `<ZoneFab />`
  sibling al `<ZoneSwiper>` (R.2.6.2).
- `src/features/shell/public.ts`: export `ZoneFab`.
- `src/features/discussions/ui/threads-section-header.tsx`: remover
  el `<Link>` "Nueva" (R.2.6.2).
- `src/app/[placeSlug]/(gated)/events/page.tsx`: remover el
  `<Link>` "Proponer evento" (R.2.6.2).
- `src/app/[placeSlug]/(gated)/conversations/loading.tsx` +
  `events/loading.tsx`: skeleton del CTA en header desaparece.
- `tests/e2e/flows/{post-crud,events-create-rsvp}.spec.ts`: assert
  links → assert FAB + menú (R.2.6.2).
- Nuevo `tests/e2e/flows/zone-fab.spec.ts`.

### 17.11 Sub-fases (R.2.6.0 → R.2.6.3)

| Sub         | Deliverable                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **R.2.6.0** | Spec § 17 (este doc, MOD) + ADR (NEW) + § 21.8 ✅ + roadmap (MOD).                                                                  |
| **R.2.6.1** | Componentes (FAB + ZoneFab) + tests unit. Sin mountar.                                                                              |
| **R.2.6.2** | Mount + remove CTAs + update skeletons + update E2E (post-crud, events-create-rsvp + nuevo zone-fab.spec.ts + extender hours-gate). |
| **R.2.6.3** | Cleanup + verificación full + manual QA (incluida decisión sobre toaster overlap si aplica) + roadmap R.2.6 ✅.                     |
