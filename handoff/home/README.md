# Home — Design Handoff Package

This folder contains everything Claude Code needs to implement the **Home** slice
of the My place app, faithful to the prototype.

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

1. Drop this whole folder into your repo at `docs/design/home/`
   (or wherever your design references live).
2. Open `PROMPT.md` and copy the prompt block.
3. Paste it into a Claude Code session inside your repo.
4. Claude Code will read the rest of the package and ask you any clarifying
   questions before implementing.

## Source of truth

The live prototype lives in this Manus/Claude project. If you need to revisit
visual details that aren't captured here, ping the design team — don't guess
based on screenshots alone.

## Out of scope for this slice

- Other tabs (Discusiones, Eventos, Biblioteca) — separate handoff packages
- Community switcher and shell chrome — separate handoff package
- Tweaks panel — design-only tool, NOT for production
