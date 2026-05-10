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

### Sesión 3 — Master-detail layout primitive + migración de `/settings/members`

**Goal:** primitive `<MasterDetailLayout>` (stack mobile, split desktop). Aplicar a members
(la sub-page más visible para admin).

**Files:**

- **NEW** `src/shared/ui/master-detail-layout.tsx` — primitive responsive:
  - Mobile: solo lista visible. Tap en item → push to detail page (route navigation).
  - Desktop: split view 360px lista + content area detail. Selección actualiza solo el detail (URL state).
  - Acepta `<List>` slot + children como detail.
- `src/app/[placeSlug]/settings/members/page.tsx` — usa `<MasterDetailLayout>`. Selected member desde URL `?member=<userId>` para shareable links + back button consistency.
- `src/app/[placeSlug]/settings/members/[userId]/page.tsx` — sigue existiendo para mobile y para directo-link, pero en desktop se renderea inline en el detail pane (RSC content del [userId] page se rehúsa, pero es lo correcto: SSO de detalle).
- **NEW** tests del primitive.

**Decisión:** la URL `?member=<userId>` en lugar de `/members/<userId>` permite split view
sin route navigation. En mobile la URL `/members/<userId>` sigue siendo full page (route
push). El componente decide qué pattern usar según viewport (CSS-driven via media-query
hidden/visible — el data se carga igual server-side, no hay doble fetch).

**Tests:**

- Master-detail mobile: solo lista, tap navega
- Master-detail desktop: split visible, click actualiza URL query

**Verificación:** suite verde + smoke en ambos viewports.

**LOC delta:** ~+300 net.

**Riesgo deploy:** medio (cambia URL pattern de members, hay que validar que routing existing no se rompe).

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

### Sesión 5 — Migrate `/settings/library` + `/settings/groups` + `/settings/tiers`

**Goal:** aplicar foundation (Sesión 1) + master-detail (Sesión 3) + RowActions (Sesión 4)
a las 3 sub-pages restantes que listan colecciones.

**Files:**

- `src/app/[placeSlug]/settings/library/page.tsx` — usa `<MasterDetailLayout>` con categories en lista, edit en detail.
- `src/app/[placeSlug]/settings/groups/page.tsx` — idem con groups.
- `src/app/[placeSlug]/settings/tiers/page.tsx` — idem con tiers.
- Refactor de rows: cada feature usa `<RowActions>`.

**Tests:** smoke de cada sub-page en ambos viewports + tests existing siguen verde.

**Verificación:** suite verde + smoke visual de las 3 sub-pages en desktop y mobile.

**LOC delta:** ~+200 net (refactors, no creación de nuevo).

**Riesgo deploy:** medio (3 sub-pages tocadas, regression risk en cada una).

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

### Sesión 7 — Keyboard shortcuts (Cmd+K + Esc + Cmd+Enter)

**Goal:** atajos de teclado canónicos para power users en desktop.

**Files:**

- **NEW** `src/shared/ui/command-palette.tsx` — wrapper de shadcn `Command` mounted en root. Abre con Cmd+K. Items: navegación a settings + search de members del place.
- `src/app/[placeSlug]/layout.tsx` o `[placeSlug]/(gated)/layout.tsx` — mount del CommandPalette (sólo desktop, hidden mobile).
- `src/shared/ui/edit-panel.tsx` (de Sesión 2) — Esc cierra el panel; si dirty, abre confirm dialog primero.
- Hooks RHF en hours-form etc. — Cmd+Enter triggers `handleSubmit` cuando focus está dentro del form.
- Tests del palette + Esc behavior + Cmd+Enter.

**Tests:**

- Command palette: Cmd+K abre, Esc cierra, navegación funciona
- Edit panel Esc: cierra si clean, prompt si dirty
- Cmd+Enter en form: trigger submit

**Verificación:** suite verde. Smoke con teclado real.

**LOC delta:** ~+250 net.

**Riesgo deploy:** medio (intercept de keyboard events tiene long tail de edge cases con inputs nativos).

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

## Resumen total

| Sesión                       | LOC delta | Riesgo | Tiempo est. |
| ---------------------------- | --------- | ------ | ----------- |
| 1 — SettingsShell foundation | +450      | Medio  | 2h          |
| 2 — Hours desktop (validate) | +200      | Bajo   | 1h          |
| 3 — Master-detail + members  | +300      | Medio  | 1.5h        |
| 4 — RowActions adaptive      | +200      | Bajo   | 1h          |
| 5 — Library + groups + tiers | +200      | Medio  | 1.5h        |
| 6 — Frequently Accessed hub  | +150      | Bajo   | 1h          |
| 7 — Keyboard shortcuts       | +250      | Medio  | 1.5h        |
| 8 — Container queries        | +100      | Bajo   | 1h          |
| **Total**                    | **+1850** | —      | **~10.5h**  |

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

## Decisiones que pueden cambiar el plan

Antes de empezar Sesión 1, confirmar:

1. **Sidebar contextual swap o coexistir con FAB**: ¿en desktop el `<SettingsNavFab>` desaparece y el sidebar lo reemplaza, o coexisten? Recomiendo reemplazo (menos chrome, más claro).
2. **Master-detail URL pattern**: `?member=<userId>` en query (split view friendly) vs `/members/<userId>` (route push). Recomiendo query en desktop, route en mobile (decide el componente).
3. **Cmd+K alcance**: ¿solo settings? ¿toda la app? ¿skeleton ahora con solo settings y full features después? Recomiendo skeleton + settings nav primero, expandir después.

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
