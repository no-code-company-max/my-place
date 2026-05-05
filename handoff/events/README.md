# Events — Design Handoff Package

This folder contains everything Claude Code needs to implement the **Events**
slice of the My place app (the Eventos tab + the event detail screen),
faithful to the prototype.

## What's in here

| File                         | Purpose                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `PROMPT.md`                  | **Start here.** Copy/paste prompt for Claude Code, with full instructions.  |
| `DESIGN_NOTES.md`            | Design intent, structure, decisions, data shape, edge cases.                |
| `components.tsx`             | Reference React/TypeScript components — structural guide, not literal code. |
| `design-tokens.css`          | CSS variables (colors, radii, padding, type) — drop into `globals.css`.     |
| `tailwind.config.snippet.ts` | Tailwind theme extension exposing the tokens as utility classes.            |
| `screenshots/`               | Visual reference of the production target.                                  |

## How to use

1. Drop this whole folder into your repo at `docs/design/events/`
   (or wherever your design references live).
2. Open `PROMPT.md` and copy the prompt block.
3. Paste it into a Claude Code session inside your repo.
4. Claude Code will read the rest of the package and ask you any clarifying
   questions before implementing.

## Source of truth

The live prototype lives in this Manus/Claude project. If you need to revisit
visual details that aren't captured here, ping the design team — don't guess
based on screenshots alone.

## Scope of this slice

Two screens:

- **Events list** — `/[community]/events` — bento grid with hero event +
  smaller cards, filters by upcoming/past.
- **Event detail** — `/[community]/events/[id]` — calendar tile, RSVP triplet,
  attendees, description, comments thread, composer.

## Out of scope for this slice

- Other tabs (Home, Discusiones, Biblioteca) — separate handoff packages
- Community switcher and shell chrome — separate handoff package
- Calendar export (.ics) and push notifications — future iteration
- Event creation form — future iteration
- Tweaks panel — design-only tool, NOT for production

## Shared primitives

This slice reuses primitives from the Home/Threads slices: `<Avatar>`,
`<BentoCard>`, `<BentoHead>`, `<SectionHead>`, `<Composer>`, `<CommentItem>`.
If those already exist in `components/ui/`, import them — do **not**
re-implement.
