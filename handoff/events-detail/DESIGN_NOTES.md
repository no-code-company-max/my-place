# Event Detail — Design Notes

## Page chrome

- Header bar: 56px sticky, `--bg`, hairline bottom.
- Back button: 36×36 surface chip.
- Share button: 36×36 surface chip with arrow-up SVG.

## Hero block

- Full-bleed image, 220px tall, no border-radius (edge-to-edge).
- Fallback (no image):
  - 120px tall, background `linear-gradient(135deg, var(--accent), var(--accent-soft))`.
  - 48px emoji centered.

## Date eyebrow

- Spacing: 18px above, 4px below.
- Font: Inter 500 / 13, color `--accent`.
- Use date-fns or Intl with `es-AR`: `EEE d MMM · HH:mm` → "Sáb 12 abr · 19:00".

## Title

- Fraunces 700 / 30 / line-height 1.15 / `letter-spacing: -0.02em`.
- `text-wrap: balance`.
- Margin: 4px top, 14px bottom.

## Meta rows

```
[icon]  Plaza del Carmen, La Plata
[icon]  3 horas
[icon]  $4.500 por persona
```

- Container: padding 16 horizontal, gap 8 vertical.
- Each row: `display: flex; gap: 10; align-items: center`.
- Icon: 16×16 SVG (or emoji), `--muted` color.
- Text: Inter 400 / 15, `--text`.
- Location row is a link → `mapsHref`.

## Section divider

- 0.5px hairline `--border`, margin 18 vertical.

## "Sobre el evento" block

- Heading: Fraunces 600 / 18, `letter-spacing: -0.01em`, margin 0 0 8.
- Body: Inter 400 / 15.5 / line-height 1.55, color `--text`. Render markdown if available.

## Host block

- Heading: same as above.
- Row: avatar 36×36 + name (Inter 600 / 14) + "anfitrión" (Inter / 12 muted) on second line.

## Attendees block

```
Asistentes (12)
[A][B][C][D][E][F][G][H]  +4
```

- Heading: Fraunces 600 / 18 + count Inter / 14 muted.
- Stack: 8 avatars max, 28×28, overlap -8, ring 1.5px `--bg`.
- "+N" pill: 28×28, `--soft` bg, Inter 600 / 11, color `--muted`.

## RSVP bar (bottom)

```
Idle:        [ Voy           ]  [🤔]
Going:       [ ✓  Vas a ir   ]
             cancelar (link below)
Maybe:       [ 🤔 Tal vez    ]
             cancelar (link below)
```

- Container: `position: sticky; bottom: 0`, `--surface` bg, top hairline.
- Padding: 12 12, plus `env(safe-area-inset-bottom)`.

### Idle state

- Primary button: full-width minus 56 (for the maybe button), height 48, radius 999.
  - Background `--accent`, color white, Inter 600 / 15.
- Maybe button: 48×48 round, `--surface` bg, 0.5px border `--border`, emoji 18.

### Going state

- Single full-width button height 48 radius 999.
- Background `--accent-soft`, color `--accent`, Inter 600 / 15.
- Below the button: "Cancelar" centered link, Inter / 13 muted, padding 6.

### Maybe state

- Same as going but with emoji prefix "🤔" and label "Tal vez".

## Tokens

| Element                | Token                        |
| ---------------------- | ---------------------------- |
| Background             | `--bg`                       |
| Hero fallback gradient | `--accent` → `--accent-soft` |
| Eyebrow text           | `--accent`                   |
| Body text              | `--text`                     |
| Muted text             | `--muted`                    |
| RSVP idle bg           | `--accent`                   |
| RSVP going bg          | `--accent-soft`              |
| RSVP going fg          | `--accent`                   |

## Behavior

- **Optimistic RSVP**: TanStack mutation `useRsvp(eventId, status)`, `onMutate` sets local state, `onError` rolls back.
- **Toast**: shadcn or Sonner — copy: "Te anotaste en el asado".
- **Share**: native `navigator.share()` if available, else copy link to clipboard with toast.
