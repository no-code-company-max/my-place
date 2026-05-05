# Library (Biblioteca de recursos)

The fourth top-level section. Browse community-curated resources organized by category.

## Layout

```
┌────────────────────────────────────┐
│ [📚]   Biblioteca                  │ ← section header
│                                    │
│  Organizado por categoría          │ ← Inter / 14 muted
│                                    │
│  ┌─────────────┐ ┌─────────────┐   │
│  │  📋         │ │  🛠         │   │
│  │             │ │             │   │
│  │ Reglamento  │ │ Servicios   │   │
│  │ 12 docs     │ │ 8 docs      │   │
│  └─────────────┘ └─────────────┘   │
│  ┌─────────────┐ ┌─────────────┐   │
│  │  📅         │ │  📞         │   │
│  │ Calendario  │ │ Contactos   │   │
│  │ 4 docs      │ │ 16 docs     │   │
│  └─────────────┘ └─────────────┘   │
│                                    │
│  ──────                            │
│                                    │
│  Recientes                         │ ← Fraunces 600/18
│  [list of latest 5 docs]           │
│                                    │
└────────────────────────────────────┘
```

## Section header

Same shape as Threads: chip 56×56 with 📚 emoji + title "Biblioteca" Fraunces 700 / 38.
Subtitle: "Organizado por categoría" Inter / 14 muted.

## Category grid

- 2-column grid, gap 10, padding 12 horizontal.
- Each card: square (aspect 1/1), `--surface` bg, 18 radius, 0.5px border `--border`.
- Padding 16. Top-left: emoji 36px. Bottom: title Fraunces 600 / 17 + count Inter / 12.5 muted.
- Tap → push `/[community]/library/[categoryId]`.

## Recents list

- Heading "Recientes" Fraunces 600 / 18.
- 5 most recent docs across all categories.
- Each row: 36×36 file icon (type-based color) + title (Inter 600 / 14) + meta "Categoría · hace 2 d" (Inter / 12 muted).
- 0.5px hairline between.

## Doc icon by type

- PDF: red soft tint, "PDF" label.
- Image: blue tint, image SVG.
- Link: green tint, link SVG.
- Doc: amber tint, doc SVG.
- Spreadsheet: teal tint, grid SVG.

## Empty state

- "Tu comunidad todavía no agregó recursos."
- CTA "Subir el primero" — opens upload sheet (out of scope v1, render disabled).

## Behavior

- Tapping a category pushes to **library-category** view.
- Tapping a recent doc opens it (PDF inline, image lightbox, link in new tab).

## Data shape

```ts
type LibraryCategory = {
  id: string
  emoji: string
  title: string
  docCount: number
  sortOrder: number
}

type LibraryDoc = {
  id: string
  categoryId: string
  categoryTitle: string
  title: string
  type: 'pdf' | 'image' | 'link' | 'doc' | 'sheet'
  url: string
  uploadedBy: string
  uploadedAt: Date
}
```
