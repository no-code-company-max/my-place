# Settings Shell — Especificación

> **Alcance:** chrome de navegación de `/settings/*` (sidebar desktop + FAB mobile + content area). Compone el `<Sidebar>` primitive agnóstico (shared) con la data específica de settings (sections + labels + icons). Reemplaza el approach actual donde el `<SettingsNavFab>` era la única navegación.

> **Referencias:** `docs/research/2026-05-10-settings-desktop-ux-research.md` (research base), `docs/plans/2026-05-10-settings-desktop-redesign.md` (plan completo), `docs/ux-patterns.md` (patrones UX canonizados), `docs/architecture.md` (boundaries shared/features), `CLAUDE.md` (principios cozytech).

## Modelo mental

El shell de settings es **chrome de navegación entre sub-pages de configuración** del place. NO es contenido — el contenido vive en cada sub-page (`/settings/hours`, `/settings/members`, etc.).

Tres responsabilidades:

1. **Navegar** entre sub-pages (visible sidebar desktop / collapsed FAB mobile).
2. **Reflejar dónde estás** (active state del item current).
3. **Servir el content area** con el padding/max-width correcto para forms admin.

## Decisión arquitectónica

**Primitive vs feature:**

- `<Sidebar>` — primitive agnóstico al dominio en `src/shared/ui/sidebar/`. Acepta items genéricos (`{ href, label, icon }`), grouping, active state, accessibility. NO sabe qué es "settings" — podría usarse para cualquier nav vertical (members directory, library categories, futuras features).
- `features/settings-shell/` — feature slice que aporta la data específica (`SETTINGS_SECTIONS` con paths, labels, icons agrupados en Place / Comunidad / Contenido) y el composer (`<SettingsShell>`) que aplica el primitive al layout de settings.

Esta separación respeta la regla `architecture.md`: `shared/` no importa de `features/`. Si el primitive viviera en una feature, otra feature no podría reusarlo.

**Responsive: NO useMediaQuery, NO userAgent middleware.** Layout CSS-driven con Tailwind:

- Sidebar 240px: `md:flex hidden` (visible desktop, oculto mobile)
- FAB existente (`<SettingsNavFab>`): wrapping con `md:hidden` (oculto desktop, visible mobile)

Coexisten por viewport — no se reemplazan en JS. Cero hydration mismatch.

## API del primitive `<Sidebar>`

Server Component agnóstico. Props:

```ts
type SidebarItem = {
  href: string
  label: string
  icon?: ReactNode
}

type SidebarGroup = {
  id: string
  label?: string // Si está, renderiza un <h3> arriba del grupo.
  items: SidebarItem[]
}

type SidebarSections = SidebarGroup[]

type Props = {
  items: SidebarSections
  currentPath: string // Server-side, inyectado por el layout caller.
  ariaLabel: string // Para el <nav aria-label="...">. Mandatory.
  className?: string // Override defaults (theming en gated zone, etc.).
}
```

**Active state:** un item es active si `item.href === currentPath`. El callsite pasa `currentPath` como prop (server-rendered). NO usamos `usePathname()` client porque queremos el primitive renderable en Server Components y sin hydration.

## Comportamiento esperado

### Render

- Wrapper `<nav aria-label={ariaLabel}>` con styles defaults (240px width, border, padding).
- Cada `SidebarGroup`:
  - Si `label`: renderiza `<h3 className="...">` con el label uppercase 11-12px (estilo settings de Linear/Stripe — convención sidebar groups).
  - `<ul>` con cada `SidebarItem` como `<li><Link href={item.href}>{icon}{label}</Link></li>`.
- Item activo:
  - `aria-current="page"` en el `<Link>`.
  - Class adicional para visual highlight (`bg-neutral-100` o similar, según `ux-patterns.md` § color palette).

### Accessibility (mandatory)

- `<nav aria-label>` siempre presente (mandatory prop).
- `aria-current="page"` en active item (assistive tech sabe dónde estás).
- Focus visible: cada item tiene `focus-visible:ring-2 focus-visible:ring-neutral-900` (o equivalente Tailwind).
- Keyboard: Tab navega entre items, Enter activa el `<Link>` (nativo del browser, no requiere JS extra).
- Touch targets: cada item ≥44px de alto (regla `ux-patterns.md` § touch targets).

### Theming

**Default chrome-neutral** (raw Tailwind neutrals según `ux-patterns.md` § color palette):

- Background: `bg-white` o `bg-neutral-50`
- Border: `border-neutral-200`
- Item hover: `hover:bg-neutral-100`
- Item active: `bg-neutral-100 text-neutral-900`
- Item idle: `text-neutral-700`
- Group label: `text-neutral-500 uppercase text-xs tracking-wider`

**Override**: prop `className` se mergea con defaults (Tailwind `tw-merge` o equivalente). Permite a la gated zone (futuro reuse) tematizar con `var(--accent)` etc.

## Composer `<SettingsShell>` (en `features/settings-shell/`)

Server Component que envuelve el content area de `/settings/*`:

```tsx
type Props = {
  children: ReactNode
  currentPath: string
  placeSlug: string // Para prefijar los hrefs de los items (sections solo tienen el suffix /settings/...)
}
```

Render:

```tsx
<div className="md:flex md:gap-6">
  <Sidebar
    items={prefixedSections}
    currentPath={currentPath}
    ariaLabel="Configuración del place"
    className="hidden md:flex"
  />
  <div className="mx-auto max-w-screen-md flex-1 px-3 py-6 md:px-8 md:py-10">{children}</div>
</div>
```

`prefixedSections` resuelve cada `item.href` agregando `/${placeSlug}` al inicio (ya que `SETTINGS_SECTIONS` solo tiene la parte estática `/settings/...`).

## Data: `SETTINGS_SECTIONS` (en `features/settings-shell/domain/sections.ts`)

Array hardcoded de groups (sin i18n en MVP — labels en español):

- **Place**: Horario, Acceso, Identidad visual
- **Comunidad**: Miembros, Grupos, Tiers
- **Contenido**: Biblioteca, Feature flags

Cada item tiene `href` (relativo, sin placeSlug) + `label` + `icon` (de `lucide-react`).

## Vista mobile root: `<SettingsMobileHub>` (en `features/settings-shell/`)

Cuando el user está en `/settings` root (mobile), renderiza un grid de cards con cada section:

- Sin sidebar (FAB ya cubre nav).
- Texto placeholder: "Pronto vivirá acá el dashboard del place. Mientras tanto, elegí una sección."
- Cada card linkea a la section con icon + label.

Cuando el dashboard real exista (futuro), reemplaza este placeholder.

## Reuse policy

`<Sidebar>` primitive es **reusable**. Casos esperados:

1. **Now**: `features/settings-shell/` (este spec).
2. **Future**: members directory en gated zone, library categories en `/library/categories`, eventos por mes en `/events`, etc. Cada caso aporta su propia `SidebarSections` y consume el primitive.

Para tematizar al brand del place en gated zone, pasar `className` con `var(--accent)`/`var(--bg)` overrides. Settings mantiene defaults neutrals (decisión `ux-patterns.md` § color palette: settings es chrome admin, no brand surface).

## Casos no cubiertos en este spec

- **`/settings` root como dashboard real**: por ahora es placeholder. Futuro plan separado.
- **Animaciones/transitions**: defaults browser (sin custom). "Cozytech: nada parpadea, nada grita".
- **Sidebar collapsible**: NO. Si el usuario quiere más espacio, es desktop (≥1024px asume sidebar siempre visible). Mobile no tiene sidebar (FAB lo reemplaza).
- **Sidebar resizable**: NO. Width fijo 240px.
- **Sub-items / nested nav**: NO en MVP. Si una section tiene sub-pages (e.g. `/settings/members/[userId]`), la nav secundaria vive en la page, no en el sidebar.
- **Search dentro del sidebar**: NO. Cmd+K palette (Sesión 7 del plan) cubre la search global.
- **Item badges (count, dot indicator)**: NO en este spec. Si en el futuro se quieren agregar (e.g. "3 nuevas invitaciones pending"), extender `SidebarItem` type.

## Cumplimiento CLAUDE.md / architecture.md

- ✅ Vertical slices: feature `settings-shell` autocontenida con `public.ts`.
- ✅ `shared/ui/sidebar/` agnóstico (no importa de features/).
- ✅ Server-first: primitive y composer son Server Components.
- ✅ Cozytech: chrome neutral, sin animaciones agresivas, sin badges/counts vanidosos.
- ✅ Mobile-first: el FAB sigue siendo el affordance principal en mobile, sidebar es additive desktop.
- ✅ Spec antes de código (este doc, pre-requisito de Sub-sesión 1a).
- ✅ Idioma: comentarios/docs en español, código en inglés.

## Tests obligatorios

`src/shared/ui/sidebar/__tests__/sidebar.test.tsx`:

- Items renderizan con label + href correcto.
- Grouping: `<h3>` headers cuando `group.label` está; sin header si `label` undefined.
- Active state: item con `href === currentPath` tiene `aria-current="page"` + active class.
- `<nav>` tiene `aria-label` correcto (mandatory).
- Items tienen `focus-visible` styles.
- Keyboard nav: Tab + Enter funciona (HTMl nativo, smoke test).
- `className` override: pasa al elemento root sin romper defaults.
- Boundary check: el primitive NO importa de `@/features/`.
