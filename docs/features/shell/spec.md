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

- `flex-1` con `{children}`. Sin swipe.
- Cada page child gestiona su propio scroll vertical interno.
- NO requiere `pt-[80px]` magic numbers (shell es static, no fixed).

### Layout root

```
<div className="mx-auto flex min-h-screen max-w-[420px] flex-col bg-bg">
  <TopBar ... />
  <SectionDots ... />
  <main className="flex-1 overflow-hidden">{children}</main>
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

| Capa                        | z-index | Notas                   |
| --------------------------- | ------- | ----------------------- |
| Section viewport            | auto    | Default                 |
| Section dots                | 20      | Static, no overlap      |
| TopBar                      | 30      | Static, no overlap      |
| Backdrop dropdown           | 40      | Fixed, full-bleed       |
| Dropdown panel              | 41      | Fixed, sobre backdrop   |
| Dialog (Radix)              | 50      | Modales del producto    |
| Toaster (sonner)            | 60      | Sobre todo              |
| Search overlay (R.4 futuro) | 60      | Mismo nivel que toaster |

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
- **R.2.5** (post, separado, su propio ADR): swipe horizontal real
  entre zonas. Refactor con framer-motion o react-swipeable.
  Decisión arquitectónica (single-page swipeable vs SSR cross-page)
  en su propio documento.
