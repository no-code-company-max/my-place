# Event Detail

Push view from an event card. Shows full event info + attendees + RSVP.

## Layout

```
┌────────────────────────────────────┐
│ ‹ atrás                       ↗    │ ← header bar
├────────────────────────────────────┤
│                                    │
│  [hero image, full-bleed, 220h]    │ ← optional
│                                    │
│  Sáb 12 abr · 19:00                │ ← Inter 500/13 muted, accent color
│                                    │
│  Asado de barrio                   │ ← Fraunces 700/30
│                                    │
│  📍 Plaza del Carmen               │
│  ⏱  3 horas                        │
│  💰 $4.500 por persona             │
│                                    │
│  ─────────                         │
│                                    │
│  Sobre el evento                   │ ← Fraunces 600/18
│  Lorem ipsum...                    │ ← Inter / 15.5 / 1.55
│                                    │
│  Anfitrión                         │
│  [LM] Lucía M.                     │
│                                    │
│  Asistentes (12)                   │ ← Fraunces 600/18
│  [stack 8 avatars] +4              │
│                                    │
└────────────────────────────────────┘
[ RSVP bar pinned to bottom ]
```

## Header

- Same shape as Thread Detail header.
- Right action: Share (↗) instead of overflow.

## Hero (optional)

- Full bleed, 220px tall, `object-fit: cover`.
- If no image: a 120px gradient block in `--accent → --accent-soft`, with the event emoji centered (48px).

## Date/time eyebrow

- Inter 500 / 13, color `--accent`.
- Format: "Sáb 12 abr · 19:00".

## Title

- Fraunces 700 / 30, `letter-spacing: -0.02em`, `text-wrap: balance`.

## Meta list

- 3 rows max: location, duration, price.
- Each: 16px emoji + Inter 400 / 15 `--text`. Gap 10 horizontal, gap 8 vertical.
- Tap location → opens maps deep link.

## Description

- "Sobre el evento" (Fraunces 600 / 18) + body Inter / 15.5 / 1.55.

## Host

- Avatar 36×36 + name Inter 600 / 14 + "anfitrión" Inter / 12 muted.

## Attendees

- Up to 8 stacked avatars (28×28, overlap -8), then "+N" pill if more.
- Tap → opens full attendee sheet (out of scope for v1).

## RSVP bar (bottom)

- Pinned at bottom of viewport, `--surface` bg, top hairline.
- Padding 12, `env(safe-area-inset-bottom)`.
- States:
  - **Not yet RSVP'd**: "Voy" (full-width pill, `--accent` bg, white text) + "Tal vez" (icon button to the left).
  - **Going**: "✓ Vas a ir" (full-width, `--accent-soft` bg, `--accent` text) + "Cancelar" (small text button below).
  - **Maybe**: "🤔 Tal vez vayas" similar styling, accent border instead of fill.

## Behavior

- Optimistic RSVP toggle.
- On RSVP success: show toast "Te anotaste en el asado".
- Calendar export: out of scope for v1, but reserve a "Agregar al calendario" link below the description.

## Data shape

```ts
type EventDetail = {
  id: string
  emoji: string
  imageUrl?: string
  title: string
  startsAt: Date
  durationMinutes: number
  location: { label: string; mapsHref?: string }
  pricePerPerson?: number
  currency?: string
  description: string
  host: { id: string; name: string; initials: string; color: string }
  attendees: { id: string; initials: string; color: string }[]
  attendeeCount: number
  myRsvp: 'going' | 'maybe' | null
}
```
