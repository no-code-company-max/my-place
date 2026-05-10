# Plan — Rediseño desktop de `/settings/*` (responsive single-codebase)

**Fecha:** 2026-05-10
**Research base:** `docs/research/2026-05-10-settings-desktop-ux-research.md`
**Patrones canónicos mobile:** `docs/ux-patterns.md`

## Context

Place está mobile-first canonizado en `/settings/*` (especialmente `/settings/hours`).
Necesitamos extender a desktop excepcional manteniendo mobile como hoy.

**Decisión arquitectónica (de la investigación):** **responsive single-codebase con Tailwind
breakpoints + container queries selectivas en componentes reusables**. NO `useMediaQuery`,
NO `userAgent` middleware, NO rutas separadas. Justificación completa en research doc.

**Outcome esperado:** después de las sesiones, abrir `the-company.place.community/settings`
desde desktop muestra un layout con sidebar 240px persistente, content area max-w-720
single-column, side drawers para edit forms (no centered modal), inline icon buttons on
hover en list rows, y atajos de teclado (Cmd+K, Esc, Cmd+Enter). Mobile sigue exactamente
igual que hoy.

## Sesiones

Total estimado: **8 sesiones**, ~12h. Cada una independiente y deployable sola.

### Sesión 1 — Foundation: `<SettingsShell>` responsive

**Goal:** primitive del shell (sidebar desktop + full-screen mobile). Todas las sub-pages
cuelgan de él. Una sub-page valida el approach.

**Files:**

- **NEW** `src/features/settings-shell/` (nueva feature slice — usa `public.ts` para exportar)
  - `ui/settings-shell.tsx` — wrapper que renderiza sidebar desktop + content area
  - `ui/settings-sidebar.tsx` — sidebar nav 240px desktop, items con sections (Place / Comunicación / Cuenta)
  - `ui/settings-mobile-hub.tsx` — vista mobile cuando estás en `/settings` root: lista completa de sub-pages + "Frequently Accessed" (placeholder, lleno en Sesión 6)
  - `domain/sections.ts` — tipo + data estática de las secciones del sidebar (path, label, icon, group)
  - `public.ts` — barrel export
- `src/app/[placeSlug]/settings/layout.tsx` — usa `<SettingsShell>` envolviendo `{children}`. Mantiene gate de auth/admin actual.
- `src/app/[placeSlug]/settings/page.tsx` — root. En desktop redirect a primera sub-page (`/settings/hours`); en mobile renderea `<SettingsMobileHub>`.
- `src/features/shell/ui/settings-nav-fab.tsx` — refactor: solo aparece en mobile (CSS `md:hidden`). En desktop el sidebar lo reemplaza.

**Decisión clave del shell:** sidebar contextual swap al estilo Discourse. Cuando el user
está en `/settings/*`, el "place chrome" del `[placeSlug]/layout.tsx` SE MANTIENE (top bar
con switcher), pero dentro del content del settings layout el sidebar agrega navegación
secundaria. NO reemplaza el shell entero — más seguro y menos blast radius.

**Tests:**

- `settings-shell.test.tsx` — render desktop tiene sidebar, mobile no (CSS-driven, validar via class presence)
- `settings-sidebar.test.tsx` — items renderean con active state cuando matchéa pathname
- Boundary test: `tests/boundaries.test.ts` valida nuevo slice respeta cross-slice rules

**Verificación:** `pnpm typecheck` + `pnpm vitest run` verde. Smoke manual: abrir
`/settings/hours` en desktop ve sidebar; en mobile no ve sidebar.

**LOC delta:** ~+450 net (nuevo slice ~350 + refactor settings layout ~50 + tests ~150 - delete settings-nav-fab desktop logic ~20).

**Riesgo deploy:** medio. Layout shell afecta TODAS las sub-pages. Tests + smoke manual son críticos.

---

### Sesión 2 — Hours desktop (validar approach con la sub-page canónica mobile)

**Goal:** migrar `/settings/hours` al nuevo shell desktop sin romper mobile. Es la canónica
de mobile (`docs/ux-patterns.md`); validar que extiende limpio a desktop.

**Files:**

- **NEW** `src/shared/ui/edit-panel.tsx` — primitive responsive: BottomSheet en mobile, Side Drawer 480-600px en desktop. CSS-driven (sin `useMediaQuery`). API similar al `<BottomSheet>` actual para drop-in replace.
- `src/features/hours/ui/week-editor-window-sheet.tsx` — usa `<EditPanel>` en lugar de `<BottomSheet>`. API igual, solo cambia el primitive.
- `src/features/hours/ui/hours-form.tsx` — content max-w-720 desktop (mantiene full-width mobile). Section spacing más amplio en desktop (`md:space-y-10`).
- `src/app/[placeSlug]/settings/hours/page.tsx` — leve adjust del padding top para no chocar con el sidebar.
- **NEW** `src/shared/ui/__tests__/edit-panel.test.tsx` — tests del primitive responsive.

**Tests:**

- EditPanel renderea BottomSheet content en mobile, SideDrawer en desktop (validar via DOM presence + classes Tailwind)
- Hours form respeta max-w-720 en desktop, full en mobile
- Validar que `<form>` y RHF siguen funcionando idéntico (smoke)

**Verificación:** suite completa verde. Smoke en ambos viewports: editar una window + guardar
debe funcionar igual.

**LOC delta:** ~+200 net (EditPanel ~80 + tests ~100 + adjusts ~20).

**Riesgo deploy:** bajo (cambio de primitive con API compatible).

---

### Sesión 3 — Master-detail con Parallel Routes (`@detail` slot) + migración de `/settings/members`

**Goal:** layout responsive con Parallel Routes de Next 15. Misma URL `/settings/members/[userId]`
sirve full page en mobile y split view en desktop, sin lógica conditional.

**Approach (Next 15 Parallel Routes):**

Estructura de carpetas:

```
app/[placeSlug]/settings/members/
  layout.tsx              ← define el grid responsive (lista + slot @detail)
  @detail/
    default.tsx           ← slot por defecto (placeholder en desktop, null en mobile)
    [userId]/
      page.tsx            ← detail content del member (RSC)
  page.tsx                ← lista de members (la "master" pane). Mobile: full ancho. Desktop: 360px izquierda.
  [userId]/
    page.tsx              ← MOBILE only: full page detail (NextJS routing match cuando slot @detail no aplica)
```

Cuando el user navega a `/settings/members/<userId>`:

- **Mobile**: `[userId]/page.tsx` se renderea full ancho (slot @detail también, pero CSS `md:block hidden` esconde la lista).
- **Desktop**: el layout muestra ambos slots. La lista (`page.tsx` de members) sigue visible a la izquierda, y el slot `@detail/[userId]/page.tsx` carga el detail a la derecha. Click en otro member actualiza solo el slot (no full route navigation), pero la URL canónica del browser SÍ refleja el change (Next handles this).

**Files:**

- **NEW** `src/shared/ui/master-detail-layout.tsx` — primitive (~80 LOC) que recibe `list` + `detail` slots y aplica el grid responsive (`md:grid md:grid-cols-[360px_1fr]` desktop, `block` mobile con CSS hide-show por presencia de detail).
- **NEW** `src/app/[placeSlug]/settings/members/layout.tsx` — wrapper del MasterDetailLayout con `{children}` (la lista) + `{detail}` (slot).
- **NEW** `src/app/[placeSlug]/settings/members/@detail/default.tsx` — placeholder cuando no hay detail seleccionado (desktop muestra empty state, mobile retorna `null`).
- **NEW** `src/app/[placeSlug]/settings/members/@detail/[userId]/page.tsx` — RSC del detail (mismo content que el `[userId]/page.tsx` actual, refactored a un component shared).
- `src/app/[placeSlug]/settings/members/[userId]/page.tsx` — refactored: importa el component shared del detail. Mobile-friendly full page (sin la lista al lado).
- `src/app/[placeSlug]/settings/members/page.tsx` — la lista. Acepta prop `selectedUserId` desde el layout para highlight del item activo.
- **NEW** tests del primitive + tests de routing (mobile vs desktop).

**Decisión:** Parallel Routes da unified URL + back/forward correcto + shareable links + Next-idiomatic. NO requiere `useMediaQuery` ni branching en code — el CSS del MasterDetailLayout maneja la responsive. Para desktop, click en un member del list usa `<Link href="/settings/members/<id>">` que Next intercept y solo updatea el slot @detail (no re-fetch del list). Para mobile, mismo Link navega full page (porque el list está hidden y el detail es full ancho).

**Tests:**

- Master-detail layout: classes responsive correctas (`md:grid-cols-[360px_1fr]` etc.)
- Slot rendering: con `[userId]` URL, slot carga el detail; sin, muestra default placeholder
- Mobile vs desktop: validar via DOM presence + classes

**Verificación:** suite verde. Smoke crítico:

- Desktop: click member A en lista → URL cambia a `/settings/members/<A>`, detail aparece a la derecha, lista permanece. Click member B → URL cambia, detail actualiza, lista permanece, back button vuelve a A.
- Mobile: tap member A → full page detail. Back button vuelve a la lista.
- Refresh en `/settings/members/<A>`: ambos viewports renderean correctamente.

**LOC delta:** ~+400 net (primitive ~80 + layout/slots ~150 + refactor [userId] ~70 + tests ~100).

**Riesgo deploy:** medio-alto. Parallel Routes son un patrón Next 15 que requiere estructura de carpetas exacta. Tests + smoke en ambos viewports son críticos. Si algo del routing se rompe, el blast radius es limitado a `/settings/members/*`.

---

### Sesión 4 — Per-row actions adaptive (`<RowActions>` primitive)

**Goal:** primitive que renderiza inline icon buttons on hover en desktop, dropdown chip-as-trigger en mobile.

**Files:**

- **NEW** `src/shared/ui/row-actions.tsx` — recibe array de `{ icon, label, onClick, destructive? }`.
  - Desktop: renderea icon buttons visibles on `hover:opacity-100 opacity-0` en el row.
  - Mobile: renderea como `<DropdownMenu>` items (mantiene chip-as-trigger del row).
  - > 3 actions: ambos viewports usan kebab `...` menu (overflow).
- Refactor de rows existentes:
  - `src/features/hours/ui/week-editor-day-row.tsx` — usa `<RowActions>` en lugar de DropdownMenu manual.
  - `src/features/members/ui/*` (rows de members en list) — idem.
- `docs/ux-patterns.md` — agregar sección "Per-row actions adaptive (mobile dropdown / desktop hover icons)".

**Tests:**

- RowActions desktop: 2 actions → 2 icon buttons hover
- RowActions mobile: 2 actions → 1 dropdown trigger
- 4 actions: ambos viewports → kebab overflow

**Verificación:** suite verde + smoke visual de hover behavior en desktop.

**LOC delta:** ~+200 net.

**Riesgo deploy:** bajo (cambio de primitive con API additive).

---

### Sesión 5 — Migrate `/settings/library` + `/settings/groups` + `/settings/tiers` con Parallel Routes

**Goal:** replicar el approach de Sesión 3 (Parallel Routes + master-detail) en las 3
sub-pages restantes que listan colecciones administrables.

**Files:**

- `src/app/[placeSlug]/settings/library/` — agregar `layout.tsx` + `@detail/` slots análogos a members. Refactor del detail content a component shared.
- `src/app/[placeSlug]/settings/groups/` — idem (groups ya tiene `[groupId]/page.tsx`).
- `src/app/[placeSlug]/settings/tiers/` — idem (verificar si tiers tiene detail page; si no, decidir si requiere o queda como single-page form).
- Refactor de rows: cada feature usa `<RowActions>` (de Sesión 4).

**Decisión sobre tiers:** si tiers no tiene detail pages hoy (es solo un form único), Sesión 5 deja tiers fuera del master-detail y solo aplica RowActions + ajustes de spacing desktop. Master-detail aplica solo a colecciones con detail navigation.

**Tests:** smoke de cada sub-page en ambos viewports + tests existing siguen verde + tests del routing parallel para library/groups.

**Verificación:** suite verde + smoke visual de las 3 sub-pages en desktop y mobile.

**LOC delta:** ~+400 net (3 sub-pages × parallel routes setup + refactors).

**Riesgo deploy:** medio (3 sub-pages con Parallel Routes; cada una es independiente, deployable separadamente si querés desglosar).

---

### Sesión 6 — "Frequently Accessed" hub mobile

**Goal:** componente `<FrequentlyAccessedHub>` que muestra top-3 settings tocadas + link al hub completo. Mobile-only. Mejora discoverability sin requerir scroll por 8-10 settings.

**Files:**

- **NEW** `src/features/settings-shell/ui/frequently-accessed-hub.tsx` — Client Component (necesita `localStorage`).
- **NEW** `src/features/settings-shell/lib/track-settings-usage.ts` — helper que incrementa contador en localStorage al navegar a una settings page (called desde sidebar items).
- `src/features/settings-shell/ui/settings-mobile-hub.tsx` (de Sesión 1) — agregar `<FrequentlyAccessedHub>` arriba.
- Tests del helper localStorage (mock).

**Tests:**

- Track helper: increment contador, persist a localStorage
- Hub: lee localStorage, ordena por count desc, renderea top-3
- SSR safety: `<FrequentlyAccessedHub>` no rompe SSR (use `'use client'` + `useEffect`)

**Verificación:** suite verde. Smoke: navegar a hours 3 veces, abrir mobile hub, hours arriba.

**LOC delta:** ~+150 net.

**Riesgo deploy:** bajo (feature additive mobile-only).

---

### Sesión 7 — Keyboard shortcuts (Cmd+K solo settings + Esc + Cmd+Enter)

**Goal:** atajos de teclado canónicos para power users **dentro de `/settings/*` exclusivamente**.
Search de members + comandos globales fuera de scope (decisión user 2026-05-10).

**Files:**

- **NEW** `src/features/settings-shell/ui/settings-command-palette.tsx` — wrapper de shadcn `Command` mounted en el `<SettingsShell>` (no en root layout). Abre con Cmd+K. Items: navegación a las 8 sub-pages de settings (Hours, Members, Library, Groups, Tiers, Access, Editor, Flags). Sin search de members ni otros comandos en este sesión.
- `src/app/[placeSlug]/settings/layout.tsx` — mount del SettingsCommandPalette (sólo dentro de settings, no toda la app). Hidden en mobile (`md:block`).
- `src/shared/ui/edit-panel.tsx` (de Sesión 2) — Esc cierra el panel; si dirty, abre confirm dialog primero.
- Hooks RHF en hours-form etc. — Cmd+Enter triggers `handleSubmit` cuando focus está dentro del form.
- Tests del palette + Esc behavior + Cmd+Enter.

**Tests:**

- Settings command palette: Cmd+K abre cuando estás en `/settings/*`, NO abre fuera de settings
- Esc cierra; navegación funciona
- Edit panel Esc: cierra si clean, prompt si dirty
- Cmd+Enter en form: trigger submit

**Verificación:** suite verde. Smoke con teclado real:

- Abrir `/settings/hours` desktop, Cmd+K → palette aparece con lista de settings
- Type "members" → highlight filtered, Enter → navega
- Abrir `/conversations` (gated zone), Cmd+K → no debe abrir el palette de settings (scope respetado)

**LOC delta:** ~+200 net (más chico que la versión global porque sin search de members).

**Riesgo deploy:** bajo-medio (intercept de keyboard events tiene long tail; al limitar a settings reducimos blast radius).

---

### Sesión 8 — Container queries en components reusables (gated zone fuera de scope, pero ready)

**Goal:** preparar componentes que viven en widths variables (master-detail desktop vs full mobile vs sidebar) para usar `@container` en lugar de `md:`/`lg:`. Set up para futuro.

**Files:**

- `src/features/members/ui/member-card.tsx` — migrar a `@container`. Container = wrapper directo del card (no viewport).
- `src/features/library/ui/library-item-card.tsx` — idem.
- `src/features/events/ui/event-list-item.tsx` — idem.
- `tailwind.config.ts` — verificar `@tailwindcss/container-queries` plugin instalado (default en v4).
- `docs/ux-patterns.md` — sección "Container queries: cuándo y cómo".

**Tests:** visuales (snapshot tests con width específico simulado).

**Verificación:** suite verde. Smoke: render member-card en sidebar 320px ancho vs feed 720px ancho — debe verse adaptado al container width, no al viewport.

**LOC delta:** ~+100 net (refactor mostly).

**Riesgo deploy:** bajo (additive, fallback de media queries sigue funcionando).

---

## Resumen total (rev. 2026-05-10 con decisiones confirmadas)

| Sesión                                                         | LOC delta | Riesgo     | Tiempo est. |
| -------------------------------------------------------------- | --------- | ---------- | ----------- |
| 1 — SettingsShell foundation (sidebar md:flex + FAB md:hidden) | +450      | Medio      | 2h          |
| 2 — Hours desktop (validate via EditPanel responsive)          | +200      | Bajo       | 1h          |
| 3 — Parallel Routes master-detail + members                    | +400      | Medio-Alto | 2h          |
| 4 — RowActions adaptive                                        | +200      | Bajo       | 1h          |
| 5 — Library + groups + tiers (Parallel Routes c/u)             | +400      | Medio      | 2h          |
| 6 — Frequently Accessed hub                                    | +150      | Bajo       | 1h          |
| 7 — Keyboard shortcuts (Cmd+K solo settings)                   | +200      | Bajo-Medio | 1h          |
| 8 — Container queries                                          | +100      | Bajo       | 1h          |
| **Total**                                                      | **+2100** | —          | **~11h**    |

**Cumplimiento CLAUDE.md / architecture.md:**

- ✅ TDD: tests primero en cada sesión.
- ✅ LOC: features `settings-shell` quedará ~700 LOC (cap 1500). Archivos individuales todos <300.
- ✅ Vertical slices: nueva feature `settings-shell/` con `public.ts`. Cambios en `shared/ui/` para primitives reusables.
- ✅ Sesiones cortas y focalizadas: 8 sesiones independientes, deployables solas.
- ✅ Idioma: comentarios/docs en español, código en inglés.
- ✅ Production-grade: zero quick fixes, primitives reusables, tests cubren happy + edge.
- ✅ No `useMediaQuery` (research-backed decision). Todo CSS-driven via Tailwind responsive.

**Reglas de trabajo agente:**

- Sin sub-agentes para implementación (todo en thread directo).
- Commit local antes de empezar cada sesión.
- Tests verdes antes de push.
- No revertir cambios anteriores (las decisiones canonizadas en `ux-patterns.md` se mantienen; el plan EXTIENDE para desktop, no reescribe).
- Si sesión X requiere modificar archivos que sesión Y planeada después también va a tocar: notificar antes y resolver conflicto.

## Decisiones confirmadas (2026-05-10)

1. **Sidebar desktop, FAB mobile**: coexisten POR VIEWPORT, no se reemplazan. El sidebar 240px se muestra `md:flex` (hidden mobile); el `<SettingsNavFab>` se muestra `md:hidden`. Cero conflicto visual; cada viewport ve un solo affordance de navegación.

2. **Master-detail con Parallel Routes (Next 15 `@detail` slot)**: unified URL `/settings/members/[userId]` mantenida en ambos viewports. Mobile renderea como full page (default). Desktop renderea el detail como slot paralelo al lado de la lista, sin route navigation entre items (back/forward funciona, shareable URLs intactos, RSC fetches independientes para list y detail). Sin SEO concerns (área restringida). Aplica análogamente a `/settings/library/[categoryId]`, `/settings/groups/[groupId]`. Ver Sesión 3 actualizada abajo.

3. **Cmd+K solo settings**: skeleton del CommandPalette con items de navegación a sub-pages de settings y nada más. Search de members + comandos globales se evalúan en sesiones futuras (no en este plan).

## Migration order recomendado

Si querés desplegar en producción incremental sin esperar las 8 sesiones:

1. **Sesión 1** — foundation (sin esto nada funciona). Deploy primero.
2. **Sesión 2** — valida con hours. Si funciona, sigan; si no, replan.
3. **Sesiones 3-5 en paralelo** (members, library, groups, tiers — cada una independiente).
4. **Sesión 4 en paralelo** con 3-5 (RowActions es additive).
5. **Sesiones 6-8** en cualquier orden (no bloquean usuarios).

## Pre-requisitos

- Verificar que Tailwind v4 está activo (necesario para `@container` en Sesión 8). `package.json` muestra `tailwindcss@^4.x` esperado.
- shadcn `Command` instalado (Sesión 7). Si no, `pnpm dlx shadcn@latest add command`.
- shadcn `Sidebar` evaluado (Sesión 1). Decidir si usamos el primitive de shadcn o construimos custom.
