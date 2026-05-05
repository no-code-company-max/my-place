# Threads — Design Notes

## Section header

```
[💬]  Discusiones
```

- Chip 56×56, white surface, 14 radius, 0.5px border. Centered emoji 32px.
- Title: Fraunces 700 / 38 / -0.02em.
- Spacing: 24px from top of viewport, 18px between chip and title.

## Filter row

- 3 pills, gap 6px.
- Active: `--text` background, `--bg` text.
- Inactive: transparent background, `--muted` text, 0.5px border `--border`.
- Padding 8/14, radius 999, font Inter 500 / 13.
- Row scrolls horizontally if needed (12px side padding, hide scrollbar).

## Featured thread (optional)

```
┌──────────────────────────────────────┐
│ [LM] Lucía M. · hace 2 h             │
│                                      │
│ ¿Alguien sabe del corte de agua?     │ ← Fraunces 700 / 22
│ Estoy sin agua desde esta mañana en  │
│ el edificio B. ¿Pasa en otros?       │ ← Inter 400 / 14, muted
│                                      │
│ [4 stacked avatars]   14 respuestas  │
└──────────────────────────────────────┘
```

- White surface, 18 radius, 0.5px border, 18px padding.
- Avatar 24×24, member color background, white initial Inter 700 / 11.
- Snippet clamped to 2 lines.
- Reader avatars: 4 × 22×22, overlap -6px, white ring 1.5px.

## Thread row (the rest)

```
[DR] Diego R. · hace 5 h
Recomendaciones para una plomera           ← Fraunces 600 / 17
Necesito alguien de confianza para...      ← Inter 400 / 13.5, muted, 1 line
[3 stacked avatars]   8 respuestas         ← Inter / 12, muted
```

- No card chrome. 14px vertical padding, 12px horizontal. 0.5px hairline divider between rows.
- Tap: full-row hit target.

## Tokens used

| Element          | Token       |
| ---------------- | ----------- |
| Background       | `--bg`      |
| Card surface     | `--surface` |
| Hairline         | `--border`  |
| Text             | `--text`    |
| Muted text       | `--muted`   |
| Pill (active) bg | `--text`    |
| Pill (active) fg | `--bg`      |

## Data shape

```ts
type Thread = {
  id: string
  authorId: string
  authorName: string
  authorInitials: string
  authorColor: string // member palette hex
  createdAt: Date
  title: string
  snippet: string // first 140 chars of body
  replies: number
  readerIds: string[] // up to 4 used in UI
  featured?: boolean
}
```

## Behavior

- Default sort: `featured` first, then `createdAt DESC`.
- Filter `Todos` → no filter.
- Filter `Sin respuesta` → `replies === 0`.
- Filter `En los que participo` → threads where `currentUserId in replierIds OR authorId === currentUserId`.

## Loading

Skeleton: 1 featured card placeholder + 4 row placeholders. Use `--soft` for skeleton bg, no shimmer needed (the rest of the app is calm).

## Empty

```
        🪶
   Todavía nadie escribió
Iniciá la conversación con un tema
       que te interese.

   [ Nueva discusión ]   ← pill, --text bg, --bg fg
```

## Accessibility

- Filter pills are `<button role="tab">` inside a `role="tablist"` (since they show different filtered lists).
- Thread rows are links (`<a href>`), not buttons — they navigate.
