# Library — Design Notes

## Section header

- Padding 24 12 0.
- Chip: 56×56, `--surface`, radius 14, 0.5 border, emoji 32px centered.
- Title: Fraunces 700 / 38 / -0.02em / `--text`.
- Subtitle (under title, full width): margin-top 6, Inter 400 / 14, `--muted`. Padding 0 12 18.

## Category grid

```css
display: grid;
grid-template-columns: 1fr 1fr;
gap: 10px;
padding: 0 12px;
```

### Card

- `aspect-ratio: 1 / 1`.
- `background: var(--surface)`.
- `border-radius: 18px`.
- `border: 0.5px solid var(--border)`.
- `padding: 16px`.
- `display: flex; flex-direction: column; justify-content: space-between`.

### Card content

- Emoji top-left, 36px font-size, line-height 1.
- Bottom block:
  - Title: Fraunces 600 / 17 / -0.01em / `--text`.
  - Count: Inter 400 / 12.5 / `--muted`. Margin-top 2.

### Card pressed

- `transform: scale(0.98)`, `transition: transform 120ms`.

## Recents block

- Margin-top 24, padding 0 12.
- Heading: Fraunces 600 / 18 / `--text`. Margin 0 0 8.
- List: white `--surface` block, radius 18, 0.5 border, divide-y children.

### Recent row

- Padding 12.
- Layout: file-icon 36 + col(title, meta) + chevron right 14, gap 12.
- Title: Inter 600 / 14 / `--text`. 1 line ellipsis.
- Meta: Inter 400 / 12 / `--muted`. Format: `{categoryTitle} · {relativeTime}`.

### File icon (36×36, radius 10)

| type  | bg                     | label/icon                                 |
| ----- | ---------------------- | ------------------------------------------ |
| pdf   | `oklch(0.95 0.04 25)`  | "PDF" Inter 700/9 in `oklch(0.55 0.18 25)` |
| image | `oklch(0.95 0.04 240)` | image SVG                                  |
| link  | `oklch(0.95 0.04 150)` | link SVG                                   |
| doc   | `oklch(0.95 0.04 75)`  | doc SVG                                    |
| sheet | `oklch(0.95 0.04 190)` | grid SVG                                   |

## Empty state (no categories yet)

- 64px emoji `📭`.
- Inter 600 / 15 "Tu comunidad todavía no agregó recursos.".
- Pill button "Subir el primero" — `--accent` bg, white text, height 40, padding 0 18, radius 999.

## Tokens

| Element         | Token       |
| --------------- | ----------- |
| Background      | `--bg`      |
| Surface (cards) | `--surface` |
| Hairlines       | `--border`  |
| Text            | `--text`    |
| Muted           | `--muted`   |
| Pill bg         | `--accent`  |
