# Plan — Cleanup legacy post-rediseño settings (3 commits)

## Context

Post-rediseño de 5 sub-pages de `/settings/*` (groups, library, members, tiers, flags) + danger-zone aplicando el patrón canónico `detail-from-list`, quedaron archivos huérfanos, duplicados, re-exports muertos y un page (`/settings/hours`) que nunca se migró al estilo canónico (header + padding pre-ADR mobile-first 2026-05-03).

Audit completo en background identificó **8 archivos para drop** + **2 tests asociados** + **5 re-exports muertos** + **1 page para migrar** + **5 loading/error files con CSS vars de brand** (deberían usar Tailwind neutrals como el resto del settings).

**Verificación pre-drop**: confirmado con grep que ningún path quedará huérfano:

- `library/public.ts` reexporta `library/items/...` directamente (NO via `items/public.ts`) → barrel `items/public.ts` 100% muerto.
- `events/rsvp/public.ts` solo `rsvpLabel` tiene caller; `RSVPButton` re-export es huérfano (el componente vive en `events/ui/rsvp-button.tsx` raíz, usado por `event-metadata-header`).

**Total LOC delta**: ~-960 dropeados / ~+30 fixes en hours + loading/error.

---

## Commit 1 — Drop archivos huérfanos + re-exports muertos

**Files to drop** (ya verificado 0 callers en producción):

- `src/features/library/items/ui/item-admin-menu.tsx` (160 LOC) — duplicado de `library/ui/item-admin-menu.tsx`.
- `src/features/library/items/public.ts` (35 LOC) — barrel 100% muerto (todos los exports tienen 0 callers; `library/public.ts` usa paths directos).
- `src/features/events/rsvp/ui/rsvp-button.tsx` (160 LOC) — duplicado de `events/ui/rsvp-button.tsx`.
- `src/features/members/ui/active-members-mini.tsx` (57 LOC) — sin callers post-OwnersAccessPanel.
- `src/features/members/invitations/ui/pending-invitations-list.tsx` (71 LOC) — pre-rediseño, reemplazado por `<MembersAdminPanel>`.
- `src/features/members/invitations/ui/resend-invitation-button.tsx` (67 LOC) — única dependencia era `pending-invitations-list.tsx`.
- `src/features/places/ui/transfer-ownership-form.tsx` (80 LOC) — reemplazado por `<TransferOwnershipPanel>` (commit 8357538).
- `src/features/members/invitations/__tests__/pending-invitations-list.test.tsx` (~106 LOC) — apunta a archivo dropeado.
- `src/features/members/invitations/__tests__/resend-invitation-button.test.tsx` (~130 LOC) — idem.

**Re-exports a limpiar**:

- `src/features/library/public.ts:100` — drop `export { ItemAdminMenu } from './ui/item-admin-menu'` si está duplicado con `library/items/public.ts` (verificar primero — el archivo del raíz puede seguir siendo el canónico). Si el archivo `library/ui/item-admin-menu.tsx` se sigue usando por callers via `library/public.ts`, NO dropear.
- `src/features/events/rsvp/public.ts` — drop `export { RSVPButton } from './ui/rsvp-button'` (mantener `rsvpLabel` que sí se usa).
- `src/features/places/public.ts:17` — drop `export { TransferOwnershipForm } from './ui/transfer-ownership-form'`.
- `src/features/members/invitations/public.server.ts:6` — drop `export { PendingInvitationsList } from './ui/pending-invitations-list'`.

**Verificación**: `pnpm typecheck` + `pnpm vitest run` + `pnpm lint` + boundaries verde.

**LOC delta**: -870 net.

**Riesgo**: cero — todos los drops son archivos sin callers.

---

## Commit 2 — Migrar `/settings/hours/page.tsx` al estilo canónico

**Único page de `/settings/*` con header + padding pre-ADR**:

- `src/app/[placeSlug]/settings/hours/page.tsx`:
  - Líneas 32-38: header inline con `<p>Settings · ${name}</p>` + `<h1 className="font-serif italic">` → reemplazar por `<PageHeader title="Horario" description="..." />`.
  - Línea 31: padding `space-y-8 p-4 md:p-8` → canónico `space-y-6 px-3 py-6 md:px-4 md:py-8` (ADR `2026-05-03-mobile-first-page-padding.md`).

**Verificación**: typecheck + vitest + visual smoke (página debe verse igual al resto del settings).

**LOC delta**: ~-5 / +5 ≈ neutro.

**Riesgo**: bajo — sólo styling.

---

## Commit 3 — Loading + error files: CSS vars de brand → Tailwind neutrals

Settings es admin chrome — debería usar raw Tailwind neutrals (`bg-neutral-*`, `border-neutral-*`, `text-neutral-*`), NO CSS vars de brand del place (`bg-surface`, `text-text`, `text-muted`, `border-border`).

**Files**:

- `src/app/[placeSlug]/settings/flags/loading.tsx` — replace `border-border bg-surface` → `border-neutral-200 bg-neutral-100` (líneas 14-16). También padding `p-4 md:p-8` → `px-3 py-6 md:px-4 md:py-8` (línea 7).
- `src/app/[placeSlug]/settings/flags/error.tsx` — replace `text-text`, `text-muted`, `border-border`, `bg-surface` por neutrals (líneas 15-16, 22).
- `src/app/[placeSlug]/settings/library/error.tsx` — idem.
- `src/app/[placeSlug]/settings/hours/loading.tsx` — replace `border-border bg-surface` por neutrals + padding `p-8` → canónico + `space-y-8` → `space-y-6`.
- `src/app/[placeSlug]/settings/tiers/loading.tsx` — replace `border-border bg-surface` por neutrals (líneas 15, 17).
- `src/app/[placeSlug]/settings/members/loading.tsx` — padding `p-8` → canónico + `space-y-10` → `space-y-6`.

**Verificación**: typecheck (no afecta runtime) + visual smoke en cada loading/error si aplica.

**LOC delta**: ~+/-30 (replaces).

**Riesgo**: cero — sólo class names visuales.

---

## NO incluido en este plan

- **`library/items/` sub-slice arquitectura** (audit § 5.1): ¿debería existir como sub-slice público o consolidar en `library/` raíz? Decisión arquitectónica que requiere su propio plan + ADR. Flagear para próximo cycle.
- **`library/items/ui/item-list.tsx`** con lógica de cursos no usada por pages simples (audit § 5.2). Considerar mover a `library/courses/` cuando se rediseñe ese sub-slice.

## Cumplimiento

- **Vertical slices**: cada drop verificado con grep cross-codebase. Cero riesgo de huérfanos cross-slice.
- **Tests**: cada test dropeado apunta exclusivamente al archivo eliminado. Tests que cubren la lógica reemplazada (e.g. `<MembersAdminPanel>` pending invitations) ya viven en `features/members/admin/__tests__/`.
- **Idioma**: drops, sin docs en español adicionales.
- **No commit empty**: los 3 commits modifican archivos reales.
