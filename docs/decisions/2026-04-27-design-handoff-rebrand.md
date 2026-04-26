# Design handoff rebrand global de tokens (F.G — events visual + theming extendido)

**Fecha:** 2026-04-27
**Milestone:** Fase 6 / F.G (apply design handoff a events + rebrand global)
**Autor:** Max
**Estado:** Aprobado (cerrado en F.G-7)

## Contexto

Tras F.F (event = thread), durante el manual QA el usuario aportó la
carpeta `handoff/events/` con el design package canónico:

- `design-tokens.css` — paleta warm-brown (`--accent: #b5633a`),
  surfaces oklch, density tokens, member palette de 8 colores fijos.
- `tailwind.config.snippet.ts` — utilities (`bg-surface`,
  `rounded-card`, `font-title`, etc.).
- `components.tsx` — guía estructural (NO copy literal).
- `DESIGN_NOTES.md` — RSVP triplet (3 estados), bento layout para
  events list, calendar tile + attendee avatars overlap para event
  detail, edge cases.
- `screenshots/` — referencia visual del target.

El handoff propone:

1. **Visual rebrand**: paleta warm-brown reemplaza el near-black
   actual.
2. **Bento layout** para events list (hero + 2col).
3. **Calendar tile + attendee avatars overlap** para event detail.
4. **RSVP triplet** (3 estados — conflicto con F.A que aprobó 4).
5. **Comments thread + composer** debajo del detail (alineado con F.F:
   event = thread).
6. **Shared primitives** (`Avatar`, `BentoCard`, etc.) — el handoff
   asume que existen; en nuestro codebase no.

## Decisiones

Se confirmaron 3 decisiones de producto antes del refactor (resuelven
conflictos entre el handoff y lo aprobado):

1. **RSVP**: mantener 4 estados (`GOING`, `GOING_CONDITIONAL`,
   `NOT_GOING_CONTRIBUTING`, `NOT_GOING`) aprobados en F.A. **NO**
   adoptar el triplet de 3 del handoff. Razón: la ontología
   (`docs/ontologia/eventos.md` § Participantes) explicita "voy / voy
   si X / no voy pero aporto Y / no voy" — el matiz texturado es del
   producto, no del visual. Restilear visualmente para parecerse al
   triplet (botones compactos, layout grid 2x2 mobile / 1x4 sm+).
2. **URL canónica**: mantener F.F (event = thread, una sola URL
   `/conversations/[postSlug]`). El visual del handoff se aplica
   DENTRO del thread vía `EventMetadataHeader`. **NO** revertir a 2
   URLs separadas que insinúa el handoff.
3. **Tokens**: rebrand global. Nuevos tokens del handoff son la source
   of truth. `--place-*` legacy se mantienen como aliases mapeados a
   los nuevos. Cada slice migra gradualmente a tokens directos.

## Implementación (F.G-0 → F.G-7)

### Estrategia de tokens (resuelve conflicto crítico con theming per-place)

El codebase tiene `buildThemeVars(place.themeConfig)` que inyecta
`--place-*` per-place via `Place.themeConfig` JSONB. Si los tokens
nuevos vivieran sólo en `:root` estático, romperían el principio "cada
place tiene identidad visual propia".

**Solución**: `ThemeConfig` se extiende con TODOS los tokens nuevos
(surface, soft, muted, border, dot, accent, accentSoft, pad,
radiusCard, titleFont, bodyFont, monoFont, memberPalette).
`buildThemeVars()` genera CSS vars de los `--place-*` legacy + los
nuevos `--bg`, `--surface`, `--accent`, `--member-1..8`. Cada place
puede customizar la paleta nueva igual que antes.

Defaults en `DEFAULT_THEME` son los valores del handoff (warm).
`globals.css` mantiene `:root` con los mismos defaults para SSR antes
que el layout per-place inyecte.

### Boundary clean: Avatar puro vs MemberAvatar wrapper

El primer impulso fue poner `deriveMemberColor(userId)` en
`shared/ui/avatar.tsx`. Esto sería **coupling oculto al dominio
members** (shared sabiendo de "miembros").

**Resolución**: `Avatar` shared es **puro**: acepta `palette:
ReadonlyArray<string>` por prop. `MemberAvatar` wrapper en
`features/members/public.ts` pasa la palette `MEMBER_PALETTE` (8
colores `var(--member-N)`) al `Avatar` shared. Si mañana otra entidad
necesita su propia palette (events, threads), wrappea con su prop sin
contaminar `shared/`.

Adicional: `Avatar` da precedencia al `imageUrl` cuando existe (no
rompe avatares reales). `initials + colorKey + palette` es fallback
para users sin avatar.

### Browser support

`oklch()` y `color-mix()` requieren Safari 16.4+, Chrome 111+, Firefox
113+ (lanzados ~2023). Browsers anteriores reciben fallbacks hex en
`globals.css`:

```css
@supports not (color: oklch(0 0 0)) {
  :root {
    --bg: #f5f1ea; /* etc */
  }
}
@supports not (color: color-mix(in srgb, red, blue)) {
  :root {
    --accent-soft: rgba(181, 99, 58, 0.14);
  }
}
```

Target documentado: la paleta degrada estéticamente pero se mantiene
coherente.

### Política de íconos

`lucide-react` se agrega como dep para nuevos componentes
(`<Check>`, `<MapPin>`, etc.). SVG inline existente (ej:
`FlagButton`) se mantiene; migra oportunísticamente al tocar el
componente. NO barrido masivo (out of scope F.G).

### Tooltip de notas GOING_CONDITIONAL

F1: HTML nativo `title="{displayName} — voy si {note}"` en avatares y
badges. Suficiente para el caso de uso. Tooltip custom (componente
shared) queda post-F1 si producto pide.

### Métricas calmas

Counts de attendees usan formato `"van 23"` con número SIN bold ni
tipografía destacada — alineado con principio "sin métricas vanidosas"
del CLAUDE.md. Diferente del handoff que usa `<span class="font-bold">23</span> "van"`
(formato social-proof rechazado).

### Date format absoluto

Formato siempre absoluto: `"Sáb 27 Abr"`. Sin "HOY"/"MAÑANA"
(violarían "sin urgencia artificial"). El usuario lee la fecha y
decide si está cerca.

### `prefers-reduced-motion`

Transitions usan `motion-safe:transition-colors`. Respeta preference
del usuario. Alineado con "nada parpadea".

### Member palette: identidad visual, no identifier

8 colores fijos por hash determinístico de `userId`. Para places ≤150
miembros, ~19 miembros por color esperados. Colisiones son aceptables
porque la palette **es identidad visual** (acompaña al displayName,
no lo reemplaza). El displayName y avatarUrl desambiguan. Cada place
puede sobrescribir `memberPalette` via `themeConfig`.

## Reservados post-F1

- Density variants (`data-density="compact|comfy"`) — tokens listos,
  UI no expuesta.
- Theme variants (`data-theme="cool|mono|dark"`) — tokens listos, UI
  no expuesta.
- `prefers-color-scheme` para dark mode auto — out of scope; default
  warm.
- Validación WCAG contrast real (`validateThemeContrast` actual sólo
  retorna `{ok: true}` con TODO Fase 7) — manual QA F.G-1 verifica
  visualmente.
- Tooltip custom (componente shared) si producto pide post-F1.
- Migración masiva de SVG inline → lucide.
- Migración de otros slices a tokens directos (sin alias `place-*`).
- Event creation form redesign (out of scope F.G).
- Filtros próximos/pasados (out of scope F.G).
- Variantes de event card (`postit/wall/minimal/countdown`) que el
  handoff documenta — default `postit` hardcoded.

## Alternativas descartadas

1. **Tokens estáticos en `:root` sin extender ThemeConfig**: rompe el
   theming per-place. Rechazado.
2. **Avatar shared con `deriveMemberColor` interno**: coupling oculto
   con dominio members. Rechazado.
3. **Adoptar 3-state RSVP del handoff**: requiere migration DB
   (eliminar valores enum), pierde matiz ontológico aprobado en F.A.
   Rechazado por user.
4. **Revertir F.F (volver a 2 URLs separadas)**: contradice refactor
   ya aprobado y commiteado, regresión UX. Rechazado por user.
5. **Reemplazar `place-*` sin alias backward-compat**: rompería
   visualmente todos los slices al instante (riesgo alto). Rechazado.
6. **Custom tooltip primitive en F.G**: scope creep. HTML nativo
   `title=` cubre F1.

## Referencias

- `handoff/events/README.md` (overview design package)
- `handoff/events/DESIGN_NOTES.md` (intent + edge cases + RSVP triplet)
- `handoff/events/design-tokens.css` (source of truth)
- `handoff/events/components.tsx` (guía estructural)
- `docs/features/events/spec.md` § 3 + § 8 + § 10 + § 10.5 (componentes
  - listado + copy + design system)
- `docs/theming.md` § "Design tokens (rebrand F.G)" (tokens config)
- `docs/decisions/2026-04-25-events-size-exception.md` (cap LOC F.A)
- `docs/decisions/2026-04-26-events-discussions-cotransaction.md` (F.E)
- `docs/decisions/2026-04-26-events-as-thread-unified-url.md` (F.F)
- Plan: `~/.claude/plans/tidy-stargazing-summit.md` § F.G

## Verificación post-F.G-7

Resultado de la verificación full al cierre de F.G:

- `pnpm typecheck`: ✓ limpio.
- `pnpm test`: ✓ 723 tests verdes (+25 nuevos en F.G):
  - `src/shared/ui/__tests__/avatar.test.tsx` (9): precedencia
    imageUrl, palette/colorKey determinismo, hashToIndex bounds.
  - `src/features/events/__tests__/format-event-time.test.ts` (8):
    helpers compactDate/timeRange/dateParts per timezone, stripping
    locale es-AR.
  - `src/features/events/__tests__/event-date-tile.test.tsx` (2):
    parts per timezone, cross-day cerca de medianoche.
  - `src/features/events/__tests__/attendee-avatars.test.tsx` (6):
    overflow, tooltip GOING_CONDITIONAL incluye nota, aria-label
    refleja count total.
- `pnpm vitest run tests/boundaries.test.ts`: ✓ 3 verdes (Avatar puro
  preserva boundary; MemberAvatar wrapper en members correcto).
- `pnpm lint`: ✓ 0 warnings (handoff/ excluido).
- `pnpm build`: ✓ limpio.
- Manual QA visual: pendiente run `pnpm dev` con `rm -rf .next` para
  validar warm rebrand en todas las pages principales (`/`, `/login`,
  `/conversations`, `/conversations/[slug]`, `/settings/hours`,
  `/settings/members`, `/settings/flags`, `/events`, `/events/new`).

## Cambios deliverados

**NEW**:

- `src/shared/ui/avatar.tsx` (+test) — Avatar puro con palette por prop.
- `src/shared/ui/section-head.tsx` — heading discreto.
- `src/shared/ui/bento.tsx` — BentoGrid + BentoCard polimórfica.
- `src/shared/ui/overline-tag.tsx` — etiqueta tipográfica liviana.
- `src/features/members/ui/member-avatar.tsx` — wrapper con
  MEMBER_PALETTE.
- `src/features/events/ui/event-date-tile.tsx` (+test) — calendar tile
  56×60.
- `src/features/events/ui/attendee-avatars.tsx` (+test) — stack
  overlap + tooltip nativo.
- `src/features/events/__tests__/format-event-time.test.ts` — 8 tests
  per timezone.

**MOD**:

- `src/shared/config/theme.ts` — ThemeConfig extendido + buildThemeVars.
- `src/app/globals.css` — tokens nuevos + @supports fallbacks.
- `tailwind.config.ts` — colors/borderRadius/spacing/fontFamily extend.
- `src/features/events/ui/format-event-time.ts` — 3 helpers nuevos.
- `src/features/events/ui/event-list.tsx` — BentoGrid + SectionHead.
- `src/features/events/ui/event-list-item.tsx` — BentoCard + hero.
- `src/features/events/ui/event-metadata-header.tsx` — calendar tile +
  attendees + RSVP layout handoff.
- `src/features/events/ui/rsvp-button.tsx` — 4 estados con layout
  compact (grid-cols-2 sm:grid-cols-4).
- `src/features/events/ui/rsvp-labels.ts` — comment update (sin RsvpList).
- `src/features/members/public.ts` — export MemberAvatar.
- `package.json` — +lucide-react.
- `eslint.config.mjs` — handoff/ excluido.
- `tsconfig.json` — handoff/ excluido (en F.G-0).
- `docs/features/events/spec.md` § 3, § 8, § 10, § 10.5 (en F.G-0).
- `docs/theming.md` — sección "Design tokens (rebrand F.G)" (en F.G-0).
- `docs/roadmap.md` — entrada F.G.

**DEL**:

- `src/features/events/ui/rsvp-list.tsx` — reemplazado por
  AttendeeAvatars en EventMetadataHeader.

## Commits (F.G-0 → F.G-7)

- `75f3156` docs(events): spec § 3+§8+§10+§10.5 + theming.md + ADR
  draft (F.G-0)
- `08f41a5` refactor(theme): rebrand global tokens + ThemeConfig
  extendido (F.G-1)
- `de64915` feat(shared/ui): primitivos del rebrand handoff (F.G-2)
- `ae57bcc` feat(members): MemberAvatar wrapper sobre shared/ui Avatar
  (F.G-3)
- `ec51740` feat(events): rediseño del listado bento (F.G-4)
- `30e7475` feat(events): rediseño del metadata header del thread
  (F.G-5)
- `9b9f37b` feat(events): RSVPButton restyle compact (F.G-6)
- (este commit) docs(events): cleanup + ADR final + roadmap (F.G-7)
