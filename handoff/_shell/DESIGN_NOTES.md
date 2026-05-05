# Shell — Design Notes

## Frame

```
┌─────────────────────────────────────┐
│ Status bar (47px)                   │
├─────────────────────────────────────┤
│ TopBar (52px)                       │  ← logo · switcher · search
│   border-bottom 0.5px var(--border) │
├─────────────────────────────────────┤
│ Dots (28px)                         │
├─────────────────────────────────────┤
│                                     │
│ Section viewport (swipeable)        │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

The shell is a **single fixed-height column**. The viewport (the part below the dots) is the only scroll region — swipe horizontally between sections, scroll vertically inside one. Status bar / topbar / dots **never move**.

## TopBar

- 36×36 buttons on left and right (logo, search). Soft surface (`--surface`) inside `--bg`. Border `0.5px var(--border)`. Radius 12.
- **Center community switcher** is a pill that fills the remaining space (`flex: 1`) up to its content; visually it looks like a centered button. Layout left → right:
  - 22×22 community avatar (square, radius 6, community color, white bold initial 11px Inter)
  - Community name — Inter 600 / 15 / -0.2 tracking. Truncate with ellipsis at ~180px.
  - Chevron (14px, muted). Rotates 180° when dropdown is open.
- The whole switcher is one tap target.
- TopBar `z-index: 3`; dropdown panel `z-index: 41` so it stacks above the viewport but below the search overlay (`z: 60`).

## Dots

- One per section in order: Home, Threads, Events, Library.
- Inactive: 6×6px circle, `--dot` color.
- Active: 18×6px pill (`border-radius: 999`), `--text` color.
- Transition `width 0.24s cubic-bezier(.3,.7,.4,1)`.
- Tap a dot → animate to that section (also reachable via swipe).

## Community dropdown

- **Anchored** below TopBar at `top: 94px` (status 47 + topbar 52 - 5 overlap).
- 18px radius, soft shadow.
- **Open animation**: `translateY(-12px → 0)` + opacity (`0 → 1`) over 220ms.
- **Backdrop**: `rgba(20,18,15,0.32)` — full-bleed, taps close.
- Each community row:
  - 38×38 avatar (square, 10px radius, community color, white bold initial)
  - Title (Inter 600 / 15) + sub (Inter / 12, muted): `{type} · {n} miembros`
  - If active: 20×20 round badge with `--accent` background, white check 12px.
- Last row is `+ Descubrir comunidades` (discovery). No active state. Out-of-scope for now — just a placeholder link.

## Status bar

A fake iOS bar — not functional. In production we don't render it (the OS does). Keep in the prototype only as a hint of the platform context. **Don't ship to production.**

## Behavior contracts

- Switching community resets the section to **0 (Home)**.
- Closing the dropdown by tapping the backdrop or selecting a community — never via swipe-down (we're not building a sheet).
- The TopBar must remain interactive while the dropdown is open (the chevron flip is a clear indicator).
- Swipe gestures are handled by the viewport, not the shell. The dots only need to listen to a `current` prop and emit `onGo(index)`.

## Tokens used

- Surfaces: `--bg`, `--surface`, `--soft`, `--border`
- Text: `--text`, `--muted`, `--accent`
- Radius: cards 16, buttons 10–12
- Type: Inter for UI, Fraunces for content (used inside sections, not in the shell itself)

## Data shape (TypeScript)

```ts
type Community = {
  id: string
  name: string
  sub: string // "Vecinos", "Grupo de lectura", etc.
  members: number
  color: string // hex — used for avatar background
}

type ShellProps = {
  community: Community
  communities: Community[]
  section: 0 | 1 | 2 | 3
  onSelectCommunity: (c: Community) => void
  onChangeSection: (i: number) => void
  onOpenSearch: () => void
}
```

## Accessibility notes

- TopBar buttons have `aria-label`s: `My place`, the community name, `Buscar`.
- Dots are buttons with `aria-label={section.label}`.
- Dropdown should trap focus while open and return focus to the switcher on close.
