# Investigación: Settings desktop UX para Place

**Fecha:** 2026-05-10
**Status:** Research consolidado, decisiones pendientes en plan separado.
**Plan asociado:** `docs/plans/2026-05-10-settings-desktop-redesign.md`

## Pregunta investigada

Place está construido mobile-first para `/settings/*` (ver `docs/ux-patterns.md`).
Necesitamos extender la experiencia a **desktop excepcional** sin sacrificar mobile.
Decisión central: **¿responsive (mismo código), adaptive (mismo código con conditional rendering), o separate (rutas/codebases distintos)?**

Audiencia desktop:

- **Admins/owners** configurando place (members, grupos, tiers, library, hours, branding).
- **Members** navegando, consumiendo y creando contenido (gated zone, fuera de scope de esta investigación).

Filosofía del producto: **cozytech** (calmo, sin métricas vanidosas, sin gamification, sin scroll infinito, identidad por place). Ver `CLAUDE.md`.

## Metodología

3 research agents lanzados en paralelo, cada uno con un ángulo:

1. **Community apps benchmarks** — Circle, Geneva, Wylo, Mighty Networks, Discourse. Cómo manejan settings desktop vs mobile.
2. **Responsive vs adaptive vs separate** — literatura UX 2024-2026. Cuándo cada estrategia.
3. **Settings/admin UX patterns desktop** — patterns canónicos de Linear, Stripe, Vercel, Notion, GitHub, Slack para settings desktop.

Reportes completos en historial de la sesión 2026-05-10. Síntesis abajo.

## Findings convergentes

Los 3 reports coinciden en estos puntos clave:

### 1. Responsive-first es la estrategia correcta para Place

- **Tu caso (≤150 users, mismo modelo mental ambos contextos) cae claramente en "responsive"**
  según múltiples comparativas 2024-2026 (UXPin, LogRocket).
- "Adaptive/separate" se justifica solo cuando los flows son radicalmente distintos
  (e.g. enterprise admin con multi-pane keyboard-first vs cliente final).
- **`useMediaQuery` y `userAgent` middleware son anti-patterns para nuestro stack RSC:**
  hydration mismatch, bundle bloat, cache fragmentation (`Vary: User-Agent` rompe edge cache).
  Ver Vercel discussion #70753, Next.js docs.
- **Container queries (Tailwind v4 `@container`) son el agregado moderno** para componentes
  que viven en widths distintos (ej. `MemberCard` en feed central vs sidebar). Limitarlas
  a 5–10 componentes; el resto, media queries de Tailwind.

**Excepción reservada:** si en el futuro aparece un dashboard admin tipo Linear (multi-pane
resizable, keyboard-first, tablas densas) que sería ridículo en mobile, ahí sí vale ruta
separada (`/admin` con su propio layout). NO anticipar; refactorizar cuando duela.

### 2. Patrones canónicos para settings desktop

Convergencia entre los 3 reports:

| Decisión                | Recomendación                                                                                                                    | Justificación cruzada                                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell desktop           | **Sidebar vertical 240px persistente, contextual swap**                                                                          | Discourse 3.4, Wylo, Linear, Vercel, GitHub, Stripe — todos. Discourse específicamente reemplaza el sidebar de browsing por el de settings al entrar a `/admin` |
| Shell mobile            | **Full-screen pages con stack navigation + "Frequently Accessed" hub**                                                           | Circle/Mighty: full-screen es más claro que drawer en mobile                                                                                                    |
| Edit forms desktop      | **Side drawer 480-600px desde la derecha** (NO centered modal)                                                                   | Smashing 2026 decision tree, Linear, Notion peek, GitHub PR side panel                                                                                          |
| Edit forms mobile       | **Mantener `<BottomSheet>` actual**                                                                                              | Ya canonizado en `ux-patterns.md`                                                                                                                               |
| Per-row actions desktop | **Inline icon buttons visibles on hover** + kebab fallback                                                                       | Linear, Notion. Reemplaza nuestro `chip-as-DropdownMenu-trigger` mobile                                                                                         |
| Per-row actions mobile  | **Mantener `<DropdownMenu>` chip-as-trigger actual**                                                                             | Ya canonizado                                                                                                                                                   |
| Forms layout            | **Single-column, label-on-top, max-w-720**                                                                                       | Stripe, Linear, Vercel 2026. NO two-column label-left (lee "enterprise rígido", anti-cozy)                                                                      |
| Members/Library/Groups  | **Master-detail split en desktop** (lista 360px + detail)                                                                        | iOS Mail pattern, Linear Issues, Notion peek, Stripe Customers                                                                                                  |
| Save patterns           | **Híbrido Primer**: autosave imperativo (toggles, selects), explicit save declarativo (text inputs). Soft barrier sigue valiendo | GitHub Primer canon. Convalida nuestro approach actual                                                                                                          |
| Density                 | **+20% más spacing que Linear** (44px row, 15px body)                                                                            | Linear es power-tool para devs; Place es cozytech para humanos                                                                                                  |
| Color palette           | **Mantener raw Tailwind neutrals en chrome desktop** (igual que mobile)                                                          | Decisión ya tomada en `ux-patterns.md`. Brand vars siguen FUERA de settings                                                                                     |
| Keyboard                | **Cmd+K palette + Esc cierra drawer + Cmd+Enter save**                                                                           | Linear, Vercel, Notion, Slack — power user expectation                                                                                                          |

### 3. Anti-patterns identificados (qué NO hacer)

De los benchmarks de community apps, varios patrones son anti-cozy:

- ❌ **Engagement dashboards / Top 50 Senders / Member Chat %** (Mighty) — viola "sin métricas vanidosas"
- ❌ **Badges, streaks, "community values" gamificadas** (Mighty) — viola "sin gamificación"
- ❌ **Drag-and-drop widget builder estilo "construí tu home"** (Wylo) — viola "nada grita"
- ❌ **Sticky save bar global "tienes cambios sin guardar"** flotando bottom — anti-cozy. Ya tenemos la versión calma con `<span aria-live="polite">• Cambios sin guardar</span>` inline
- ❌ **Density tipo Linear (36px rows, 13px body)** — para devs, no para "pub conocido"
- ❌ **Top tabs horizontales para nav primaria** — no escala >5 items
- ❌ **Centered modal para edit forms largos** — bloquea contexto del list
- ❌ **Color override imposición admin → member sin escape** (Geneva) — si copiamos customización por place, respetar `prefers-reduced-motion` / `prefers-contrast`
- ❌ **Two-column label-left enterprise** — lee a software corporativo, no a pub conocido
- ❌ **Auto-disabled save buttons** (Primer): fallan accesibilidad
- ❌ **Iconos sin label en sidebar expandido** — learning tax, anti-discoverability
- ❌ **Mezclar autosave y explicit save en el mismo form** (Primer regla #1)

### 4. Lo que adoptamos como NUEVO (no estaba en `ux-patterns.md`)

1. **Sidebar vertical persistente para `/settings/*` desktop** (240px, contextual swap)
2. **Master-detail split** para `/settings/members`, `/settings/library`, `/settings/groups`
3. **Side drawer 480-600px** como reemplazo desktop de `<BottomSheet>` mobile
4. **Inline icon buttons on hover** como reemplazo desktop de `<DropdownMenu>` chip-as-trigger
5. **Container queries selectivas** en componentes reutilizables entre contextos
6. **Cmd+K palette + atajos** para power users en settings
7. **"Frequently Accessed" hub en mobile** (top-3 settings tocadas + acceso al sidebar completo)
8. **Patrón Primer híbrido** para save patterns documentado explícitamente

### 5. Hallazgos por producto benchmark

**Circle** — Decisión valiente: admin solo en web, mobile es member-only. **No aplica a Place** (queremos full-funcional ambos). Lo rescatable: separación clara member-experience vs admin-experience en el shell.

**Discourse** — Sidebar admin **contextual** (solo aparece en `/admin`, reemplaza el sidebar de browsing). Patrón muy fuerte y limpio. **Adoptable directamente para Place.** Top-tabs deprecadas en 3.4.

**Mighty Networks** — Filosofía contraria a cozytech (badges, streaks, engagement dashboards). Lo único rescatable: el patrón **"Frequently Accessed" hub** (top 4 settings más usadas).

**Wylo** — Feature toggles modulares ("enable only the features you need"). Encaja con "place tiene su propio ritmo". **Adoptable.** Drag-to-reorder de menú lateral: NO adoptar (caos visual viola "nada grita").

**Geneva** — Mobile-first y mobile-primary; **crítica recurrente**: side panel "visualmente sobreestimulante", cambios estéticos constantes que rompen familiaridad, no permite override de colores del admin a nivel personal. **Lección para Place:** la customización del admin puede volverse imposición.

## Bibliografía

### Strategy (responsive vs adaptive vs separate)

- [Container Queries in 2026 — LogRocket](https://blog.logrocket.com/container-queries-2026/)
- [Container Queries Unleashed — Josh W. Comeau](https://www.joshwcomeau.com/css/container-queries-unleashed/)
- [The future of responsive design — Una Kravets & Adam Argyle (Config)](https://www.youtube.com/watch?v=APhECDy2U3U)
- [Vercel KB — Rendering content based on device](https://vercel.com/kb/guide/rendering-content-based-on-device)
- [Next.js — `userAgent` API reference](https://nextjs.org/docs/app/api-reference/functions/userAgent)
- [Next.js Discussion #70753 — useMediaQuery hydration mismatch](https://github.com/vercel/next.js/discussions/70753)
- [Managing useMediaQuery Hydration Errors in Next.js — Dwin](https://medium.com/@dwinTech/managing-usemediaquery-hydration-errors-in-next-js-9ecc555542c7)
- [Designing Mobile Tables — UXmatters](https://www.uxmatters.com/mt/archives/2020/07/designing-mobile-tables.php)
- [Responsive vs Adaptive 2026 — UXPin](https://www.uxpin.com/studio/blog/responsive-vs-adaptive-design-whats-best-choice-designers/)

### Settings/admin UX patterns

- [Smashing — Modal vs Separate Page Decision Tree (2026)](https://www.smashingmagazine.com/2026/03/modal-separate-page-ux-decision-tree/)
- [GitHub Primer — Saving patterns](https://primer.style/product/ui-patterns/saving/)
- [Linear — How we redesigned the UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Alf Design — Sidebar specs 2026](https://www.alfdesigngroup.com/post/improve-your-sidebar-design-for-web-apps)
- [Evil Martians — 5 dev tool UI patterns](https://evilmartians.com/chronicles/keep-it-together-5-essential-design-patterns-for-dev-tool-uis)
- [Microsoft — List/Details pattern](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/list-details)
- [Maggie Appleton — Command Bars](https://maggieappleton.com/command-bar)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar)
- [Building Calm Interfaces 2026](https://medium.com/@mindcodersindore/building-calm-interfaces-less-is-more-in-2026-eab5fd810413)

### Community apps benchmarks

- [Circle: Admin dashboard](https://help.circle.so/p/basics/getting-started/get-to-know-the-admin-dashboard)
- [Circle: features desktop vs mobile](https://help.circle.so/p/basics/getting-started/circle-features-desktop-vs-mobile-apps)
- [Discourse: Introducing admin sidebar navigation](https://meta.discourse.org/t/introducing-admin-sidebar-navigation/289281)
- [Mighty Networks: Manage Admin Settings](https://docs.mightynetworks.com/en/articles/9140597-how-do-i-manage-my-admin-settings)
- [Wylo: How to Use Wylo guide](https://www.fahimai.com/how-to-use-wylo)

## Decisiones que requieren plan separado

- Cuándo aplicar el rediseño a cada sub-page (`hours`, `members`, `library`, `groups`, `tiers`, `access`, `editor`, `flags`).
- Orden óptimo de las sesiones (foundation primero vs página visible primero).
- Si el primitive shell desktop debe ser shared con la gated zone o exclusivo de settings.
- Cuándo introducir Cmd+K (skeleton ahora vs feature completa después).

Ver `docs/plans/2026-05-10-settings-desktop-redesign.md`.
