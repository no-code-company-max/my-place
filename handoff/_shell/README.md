# Shell — Status bar, TopBar, Dots, Community Switcher

**This is the shared chrome that wraps every section** (Home, Threads, Events, Library).
Implement this **first**, then the section slices plug into it.

## What's here

| File                         | Purpose                                               |
| ---------------------------- | ----------------------------------------------------- |
| `DESIGN_NOTES.md`            | Layout, behavior, states for the entire shell         |
| `PROMPT.md`                  | Drop-in prompt for Claude Code                        |
| `components.tsx`             | Reference JSX (inline styles → translate to Tailwind) |
| `design-tokens.css`          | Same tokens as the other slices — **only paste once** |
| `tailwind.config.snippet.ts` | Same snippet as the other slices                      |
| `screenshots/`               | Visual reference                                      |

## What the shell renders, top → bottom

1. **Status bar** (`9:41` + signal/wifi/battery) — purely cosmetic for the prototype; in production this is the OS bar.
2. **TopBar** — three slots:
   - **Left**: app logo (My place hex) — currently no action; reserved for future "back to global feed".
   - **Center**: community switcher pill — `[avatar][community name][chevron]`. Tap → opens `CommunityDropdown`.
   - **Right**: search button (icon-only). Tap → opens search overlay (see `handoff/search/`).
3. **Dots** — one dot per top-level section. Active dot becomes a 18×6px pill. Tap a dot → jump to that section.
4. **Section content** (the swipeable horizontal viewport — Home, Threads, Events, Library).

## Community dropdown

Pushes **down from below the TopBar** (top: 94px) over a 32% scrim.

- Header: `TUS COMUNIDADES` (caps, muted)
- One row per community: avatar (square 38×38, community color, white initial), name, `sub · members miembros`, check pill if active.
- Last row: `+ Descubrir comunidades` with dashed-border icon — opens community discovery flow (out of scope for the slice; just a placeholder route).

## Don't reimplement these per section

The shell stays mounted across sections. The section components only render **content below the dots**, never the status bar / topbar / dots.
