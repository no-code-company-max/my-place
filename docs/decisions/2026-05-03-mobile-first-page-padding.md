# ADR — Standard de horizontal padding mobile-first en pages

**Fecha**: 2026-05-03
**Estado**: Aceptada
**Plan**: redesign de `/settings/hours` (UI mobile-first)

## Contexto

Auditoría reveló inconsistencia en horizontal padding entre pages:

| Patrón                 | Pages                                              | Mobile px            |
| ---------------------- | -------------------------------------------------- | -------------------- |
| `p-8` (sin responsive) | 6                                                  | 32px                 |
| `p-4 md:p-8`           | 5                                                  | 16px → 32px          |
| `px-3 py-6`            | 1 (`library/page.tsx`)                             | 12px                 |
| Sin wrapper padding    | 3 (gated zones — conversations, library categoría) | — (delegado a items) |

El `<TopBar>` ya usa `px-3` (12px) — el ancho es el estándar implícito de la zona gated, pero settings nunca lo adoptó.

Sintomas concretos:

- `/settings/hours` con `p-8` (32px) en viewport de 360px deja sólo ~296px útiles. El form "agregar día" (4 inputs en grid horizontal) excede ese ancho → scroll horizontal indeseado.
- Discrepancia visual entre zone gated (12px) y settings (32px) genera la sensación de que settings es "otra app".

## Decisión

**Mobile-first standard**: todos los page wrappers de settings + member detail + inbox usan `px-3 md:px-4` (12px mobile, 16px desktop). Vertical padding queda libre por page (`py-6`, `py-8`, etc. según densidad).

```tsx
// Patrón canónico para settings sub-pages
<div className="space-y-6 px-3 py-6 md:px-4 md:py-8">{/* contenido */}</div>
```

### Excepciones

1. **Gated zone pages** (conversations, library list): siguen sin wrapper padding. Sus items aplican `mx-3` per-component para edge-to-edge cards con visual continuity respecto al `<TopBar px-3>`. Patrón intencional — no cambiar.

2. **Member profile** (`/m/[userId]`): es un page contextual con su propia composición visual. Mantiene `p-4 md:p-8` por ahora (decisión separada si emerge feedback).

3. **Inbox** (`/inbox`): es un standalone page (no gated, no settings). Mantiene `p-8` con `max-w-2xl mx-auto` — pattern de "centered narrow content" intencional.

### `<PageHeader>` shared component

Para cerrar la inconsistencia de headers redundantes (ej: `Settings · The Company` que repite contexto que el URL + `SettingsNavFab` ya proveen), introducimos `<PageHeader>` en `src/shared/ui/page-header.tsx`. Provee:

- `title` (h1, `font-serif text-2xl md:text-3xl`)
- `description` opcional (`text-sm text-muted`)
- `actions` slot opcional (botones a la derecha)

NO incluye breadcrumbs ni "Settings · ..." — el contexto navegacional es responsabilidad del shell, no de cada page.

### `<BottomSheet>` shared component

Para forms de "agregar / editar" en mobile, introducimos `<BottomSheet>` en `src/shared/ui/bottom-sheet.tsx`. Resuelve el problema de overflow inline + sigue best practices NN/g + Material 3:

- Ancla al bottom del viewport con `transform: translateY(0)`.
- Drag handle visible + close button explícito (no rely on swipe-only).
- Sticky CTA bottom con `safe-area-inset-bottom`.
- `max-height: 85vh` con scroll interno.
- Backdrop semi-transparente para context awareness.

Wraps Radix Dialog (mismo focus trap / ESC / aria-modal que `<Dialog>`). Co-existe con `<Dialog>` que sigue siendo el shape para diálogos centrados (confirms, alerts cortos).

## Consecuencias

**Positivas**:

- Consistencia visual entre pages (12px/16px coherente).
- Resuelve overflow de `/settings/hours` reduciendo padding de 32px → 12px (gana 40px de ancho útil en mobile).
- `<PageHeader>` + `<BottomSheet>` quedan como primitives reusables — futuras settings pages no inventan sus propios patrones.

**Negativas**:

- 5+ pages de settings necesitan refactor de wrapper class. Mecánico, low-risk.
- Algunos componentes internos asumen padding parent — auditar y compensar con su propio padding si necesitan respiración (ej: cards que iban edge-to-edge en `p-8` ahora pueden quedar pegadas al borde con `px-3`).

**Métrica de éxito**: viewport 360px renderiza `/settings/hours` sin scroll horizontal, con cada section claramente separada y forms de add/edit accesibles vía bottom sheet.

## Alternativas descartadas

1. **Aplicar el padding en `settings/layout.tsx`** (single source). Rechazado: las gated zone pages NO tienen settings/layout, y member profile + inbox tampoco — no hay un layout común. Ponerlo per-page es más explícito y permite excepciones declarativas.

2. **`px-4` (16px) mobile como standard**. Rechazado: el `<TopBar>` ya usa `px-3`, y romper alignment con la zona gated re-introduce la sensación de "otra app". 12px es lo que ya funciona bien en conversations.

3. **Mantener `p-8` y solucionar overflow refactorizando solo el form**. Rechazado: el overflow es síntoma, la causa real es la inconsistencia de density en mobile. Standardizar resuelve también el problema de que los forms futuros caen en la misma trampa.
