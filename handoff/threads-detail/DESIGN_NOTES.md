# Thread Detail — Design Notes

## Header

- Sticky top, 56px, `--bg`, hairline bottom `0.5px var(--border)`.
- 12px horizontal padding.
- Back: 36×36 surface chip (same as TopBar).
- Overflow: 36×36 surface chip with three dots SVG (Inter weight, 18px).

## Title

- Fraunces 700, **28px**, `letter-spacing: -0.02em`, `text-wrap: balance`.
- Margin: 14px from author row, 14px to body.

## Body

- Inter 400 / 16 / line-height 1.55.
- Spacing-y between paragraphs: 12px.
- Links: `--accent`, no underline, hover underline.
- Code: monospace, `--soft` background, 4px radius, 2/4 padding.

## Action row

```
♥  4    💬  14    ↗
```

- 3 icon buttons, left-aligned, gap 18px.
- 36×36 hit target, but visually icon + count is just 16px icon + 14px Inter.
- `--muted` color. When liked: heart fills, color `--accent`.

## Readers

```
[ABCDE]  18 leyeron
```

- 5 avatars max, 22×22, 1.5px ring `--bg`, overlap -6px.
- Inter / 13, `--muted`.

## Replies section

- Top spacing 18px, top hairline `0.5px var(--border)`.
- Section label: Inter 600 / 11 caps `--muted` letter-spacing 0.6 — `{n} RESPUESTAS`.

## Reply row

```
[DR] Diego R. · hace 1 h

Sí, también me pasa en el A.

[♥]  responder
```

- 14px vertical padding, 0.5px hairline below (last reply has no hairline).
- Author row: 28×28 avatar + name (Inter 600 / 14) + time (Inter / 12 muted).
- Body: Inter / 14.5 / 1.55.
- Footer: heart toggle + "responder" link, Inter / 12 muted, gap 14.

## Quoted reply (citation)

```
│ "Sí, también me pasa en el A."
│ ─ Diego R.
Ya está reportado a Aysa.
```

- Block above the body. Left border 2px `--accent`, padding-left 10.
- Quoted text: italic, 1 line clamp, Inter / 13.5, `--muted`.
- Author tag below: Inter 500 / 11.5, `--muted`.

## Composer

- Pinned: `position: sticky; bottom: 0` inside the scrollable viewport, OR `fixed` if you control the viewport.
- Background `--surface`, top hairline `0.5px var(--border)`.
- Padding: 8 12, plus `env(safe-area-inset-bottom)` at bottom.
- Layout: avatar 36×36 + textarea grow + send button 36×36 round, `--accent` bg, white arrow icon.
- Textarea: Inter / 15, auto-grow up to 4 lines, then scroll. No border, transparent bg.
- Placeholder: "Escribí una respuesta…", `--muted`.

## Quoting chip (inside composer)

- When user long-presses a reply and picks "Citar":
  - Above the textarea, render a chip:
    - 2px left accent border, "Citando a Diego R.: 'Sí, también me pasa…'", small × button.
    - Tap × to clear quote.

## Data shape

```ts
type Reply = {
  id: string
  authorId: string
  authorName: string
  authorInitials: string
  authorColor: string
  createdAt: Date
  body: string
  likeCount: number
  likedByMe: boolean
  quoteOf?: string // id of another Reply
}

type ThreadDetail = {
  thread: {
    id: string
    authorId: string
    authorName: string
    authorInitials: string
    authorColor: string
    createdAt: Date
    title: string
    body: string
    likeCount: number
    likedByMe: boolean
    readerCount: number
    readerSample: { id: string; initials: string; color: string }[]
  }
  replies: Reply[]
}
```

## Tokens used

| Element                          | Token       |
| -------------------------------- | ----------- |
| Background                       | `--bg`      |
| Surface (composer, header chips) | `--surface` |
| Hairline                         | `--border`  |
| Accent (heart, send, quote bar)  | `--accent`  |
| Muted text                       | `--muted`   |
| Body text                        | `--text`    |

## Behavior

- **Optimistic send**: `onMutate` inserts a temporary reply at the bottom; `onSuccess` swaps with server-assigned id.
- **Scroll**: after successful send, smooth-scroll to the new reply.
- **Cite**: long-press (or right-click) on a reply opens a small menu — `Citar` / `Copiar` / `Reportar`. We only need `Citar` for v1.
