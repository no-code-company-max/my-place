# Library Category

Push view from a category card. Shows all docs in that category, filterable by type.

## Layout

```
┌────────────────────────────────────┐
│ ‹ Biblioteca                       │ ← back to library
├────────────────────────────────────┤
│                                    │
│  Reglamento                        │ ← Fraunces 700/30
│  12 documentos                     │ ← Inter / 13 muted
│                                    │
│  [Todos] [PDF] [Links] [Imágenes]  │ ← type filter pills
│                                    │
│  ┌────────────────────────────┐    │
│  │ [PDF] Reglamento general   │    │
│  │ Subido por Lucía · 12 abr  │    │
│  ├────────────────────────────┤    │
│  │ [PDF] Anexo de mascotas    │    │
│  │ ...                        │    │
│  ├────────────────────────────┤    │
│  │ [🔗] Página oficial        │    │
│  │ ...                        │    │
│  └────────────────────────────┘    │
│                                    │
└────────────────────────────────────┘
```

## Header bar

- Same as Thread Detail: 56px sticky, back chevron + label "Biblioteca".
- Right: search icon (filters within this category).

## Title block

- Padding 18 12 0.
- Title: Fraunces 700 / 30 / -0.02em / `--text`.
- Count: Inter / 13 / `--muted`. Margin-top 4.

## Type filter pills

- Same component as Threads filter row.
- Items: `Todos`, `PDF`, `Links`, `Imágenes`, `Hojas`, `Docs`. Hide pills for types that don't exist in this category.

## Doc list

- White `--surface` block, radius 18, 0.5 border, divide-y children. Same as Recents.
- Each row: `RecentDocRow` component (reused from library).

## Empty state (no docs match filter)

- Centered icon 48 + Inter 500 / 14 "Sin resultados" + Inter / 13 muted "Probá otro filtro" + button "Limpiar filtros".

## Behavior

- Tap a doc:
  - PDF → full-screen sheet with `<iframe src={url}>` and a close X.
  - Image → lightbox (Radix Dialog or simple full-screen `<img>` + close).
  - Link → `window.open(url, '_blank', 'noopener,noreferrer')`.
  - Doc/Sheet → tab + open.

## Data

- Same `LibraryDoc[]` from library/. Filter on the client by type (cheap).
