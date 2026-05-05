# Search

Global search overlay opened from the magnifier icon in the TopBar. Searches across all 4 sections of the active community.

## Layout

```
┌────────────────────────────────────┐
│ ‹     [🔎  Buscar en Mi Lugar...] │ ← search bar (replaces TopBar)
├────────────────────────────────────┤
│                                    │
│  RECIENTES                         │ ← shown when query is empty
│  asado                             │
│  reglamento                        │
│  Lucía                             │
│                                    │
│  ───────                           │
│                                    │
│  SUGERIDO                          │
│  📅 Próximo evento                 │
│  💬 Discusiones activas            │
│  📚 Documentos nuevos              │
│                                    │
└────────────────────────────────────┘

When typing:

┌────────────────────────────────────┐
│ ‹     [🔎  asad         ✕]         │
├────────────────────────────────────┤
│  EVENTOS (1)                       │
│  📅 Asado de barrio · sáb 19:00    │
│                                    │
│  DISCUSIONES (2)                   │
│  💬 Asado del sábado               │
│  💬 ¿Quién trae carbón?            │
│                                    │
│  PERSONAS (1)                      │
│  [LM] Lucía M.                     │
│                                    │
└────────────────────────────────────┘
```

## Header

- Replaces the TopBar entirely while open. 56px sticky.
- Back chevron (36×36 surface chip) + search input.
- Search input: 40px tall, `--surface` bg, radius 999, full remaining width.
  - Magnifier icon left (16px, `--muted`).
  - Placeholder: "Buscar en {communityName}…"
  - Clear (✕) right when value present.
- Auto-focus on open.

## Empty state (no query)

- Section "RECIENTES": last 5 search queries from localStorage (Inter / 13 muted caps title + 36px rows).
- Divider (0.5 hairline).
- Section "SUGERIDO": 3 quick-jumps to active sections.

## Results state (query > 0 chars)

- Group results by type: Eventos, Discusiones, Personas, Documentos.
- Each group: section title (Inter 600 / 11 caps muted, letter-spacing 0.6) with count.
- Max 5 results per group + "ver todos" link if more.
- Tap → navigate to detail.

## No results

- Centered: 48 emoji `🔎` + Inter 500 / 14 "Sin resultados para '{query}'".

## Behavior

- Debounced search: 200ms after typing stops.
- Save query to localStorage on submit OR on result tap. Cap at 5 recents.
- Close: back chevron OR Escape OR tap result. Restore the section the user was on.

## Data shape

```ts
type SearchResult =
  | { type: 'event'; id: string; title: string; date: Date; emoji: string }
  | { type: 'thread'; id: string; title: string; replies: number }
  | { type: 'person'; id: string; name: string; initials: string; color: string }
  | { type: 'doc'; id: string; title: string; categoryTitle: string; docType: DocType }

type SearchResponse = {
  events: SearchResult[]
  threads: SearchResult[]
  people: SearchResult[]
  docs: SearchResult[]
}
```
