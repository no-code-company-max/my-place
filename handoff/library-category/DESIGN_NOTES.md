# Library Category — Design Notes

## Header bar

- 56px sticky, `--bg`, hairline bottom.
- Back: 36×36 surface chip + 14px Inter 500 label "Biblioteca", gap 8.
- Right: 36×36 surface chip with magnifier SVG.

## Title block

- Padding 18 12 0.
- Title: Fraunces 700 / 30 / -0.02em.
- Count: Inter 400 / 13 / `--muted`. Margin-top 4. Format: `{n} documentos`.

## Type filter pills

- Padding 14 12 4. `display: flex; gap: 6; overflow-x: auto`.
- Same active/inactive styling as Threads filter (active: `--text` bg + `--bg` fg; inactive: transparent + 0.5 border + `--muted`).
- Hide scrollbar.

## Doc list container

- Margin 4 12 24 12.
- `--surface` bg, 18 radius, 0.5 border, `overflow: hidden`.

## Doc row

- Reuse `RecentDocRow` from library/components.tsx.
- 12 padding, 36 file icon, title Inter 600 / 14, meta Inter / 12 muted.
- Hairline 0.5 between rows.

## PDF viewer sheet

- Full-screen overlay, `--bg`.
- Top bar 56px: title (clamp 1 line) center + close X right.
- `<iframe src={url}>` fills rest. Allow zoom on mobile.

## Image lightbox

- Full-screen `--text` bg (almost black).
- Image centered with `object-fit: contain`.
- Close X top-right (white, 28×28).
- Tap outside dismisses.

## Empty state

- Padding 48 24, centered.
- 48 emoji `🔎`, Inter 500 / 14 "Sin resultados", Inter / 13 muted "Probá otro filtro".
- Pill button "Limpiar filtros" — `--soft` bg, `--text` fg, height 36, radius 999.

## Tokens — same as Library
