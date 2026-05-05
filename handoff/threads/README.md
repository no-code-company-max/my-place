# Threads (Discusiones)

The discussions feed for a community. The second top-level section.

## Layout

- **Section header**: emoji chip + "Discusiones" title (Fraunces 700 / 28).
- **Filter row**: 3 pill chips — `Todos`, `Sin respuesta`, `En los que participo`. The first is selected by default. Horizontal scroll if they overflow.
- **Featured thread** (only if there's a "pinned" / hottest one): full-width card with title, snippet, last activity, reply count, and 4 reader avatars stacked.
- **Rest of threads**: vertical list. Each row: avatar + author name + relative time, title (Fraunces 600 / 17), one-line snippet, footer with reply count + 4 stacked reader avatars.

## Behavior

- Tap a row → push `/[community]/t/[threadId]` (Thread Detail).
- Filter pills are local state for now; the slice doesn't persist them.
- Pull-to-refresh: nice to have, not critical for v1.

## Visual notes

- 0.5px hairlines between rows (no boxy cards for the feed — only the featured one is a card).
- Time format: relative within 24h ("hace 2 h"), then "ayer", "hace 3 d", then dates.
- Reply count: prefer "14 respuestas" over "14" alone.
- Reader avatars: 4 max, overlap by 6px, ring of `--bg` 1.5px to separate.

## Empty state

- Big quote-mark emoji or simple SVG, centered.
- Title: "Todavía nadie escribió"
- Subtitle: "Iniciá la conversación con un tema que te interese."
- CTA: pill button "Nueva discusión".

## Files

- `DESIGN_NOTES.md` — exact tokens, type sizes, behavior.
- `PROMPT.md` — for Claude Code.
- `components.tsx` — reference JSX (translate to Tailwind).
- `screenshots/` — visual reference.
