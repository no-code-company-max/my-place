# My place — Design Handoff

Mobile-first community app. Bento layout, swipeable sections, warm minimalist palette.

## Order of implementation (slices)

```
1.  _shell/                ← do this first; everyone else plugs in
2.  home/                  ← can ship standalone (read-only)
3.  threads/               ← needs _shell
4.  threads-detail/        ← needs threads
5.  events/                ← needs _shell
6.  events-detail/         ← needs events
7.  library/               ← needs _shell
8.  library-category/      ← needs library
9.  search/                ← cuts across everything
```

Each slice folder is **self-contained**: it has its own README, DESIGN_NOTES, PROMPT, components.tsx, design-tokens.css, tailwind snippet, and screenshots. The tokens and Tailwind snippet are **identical across slices** — paste them once into your repo and ignore the duplicates.

## What each file is for

| File                         | Audience                                                 |
| ---------------------------- | -------------------------------------------------------- |
| `README.md`                  | You — high-level map of the slice                        |
| `DESIGN_NOTES.md`            | You + Claude Code — layout, behavior, states, data shape |
| `PROMPT.md`                  | Drop-in prompt to paste into Claude Code terminal        |
| `components.tsx`             | Reference JSX (inline styles → translate to Tailwind)    |
| `design-tokens.css`          | CSS variables, paste once into `app/globals.css`         |
| `tailwind.config.snippet.ts` | Theme extension, paste once into `tailwind.config.ts`    |
| `screenshots/`               | Visual reference                                         |

## Recommended Claude Code flow

1. Open the repo, `cd` into it.
2. Drop the whole `handoff/` folder into the repo as `docs/design/`.
3. Open the `_shell/PROMPT.md`, paste into Claude Code, run.
4. Repeat for each slice in order. Claude Code can re-read `docs/design/<slice>/` whenever it needs context.

## Stack assumptions baked into the prompts

- Next.js 15 (App Router) + React 19, TypeScript strict
- Tailwind + CSS variables (tokens stay as CSS vars; Tailwind reads them)
- Prisma + Supabase, TanStack Query
- Vertical slices, Server Components by default, Client only where needed

If your stack is different, tweak the PROMPTs but keep the DESIGN_NOTES — those are framework-agnostic.

## Visual system in 30 seconds

- **Type**: Fraunces (titles) + Inter (UI). `--title-font` / `--body-font`.
- **Surfaces**: `--bg` warm cream, `--surface` white, `--soft` for chips.
- **Accent**: `#b5633a` (terracotta) — used sparingly. Highlight, not fill.
- **Radius**: 16 cards, 10–12 buttons, 18 sheets/dropdowns.
- **Density**: regular default. `[data-density]` toggles `--pad` / `--radius-card`.
- **Themes**: warm (default), cool, mono, dark. `[data-theme]` switches.

## Screens in this handoff

```
Top-level (sections, swipeable):
┌─ Home          → bento with latest thread + next event + library docs
├─ Threads       → list of discussions, featured + rest
├─ Events        → bento with hero event + 2-col grid
└─ Library       → categories grid (PDFs, notas, links, …)

Detail (push):
┌─ Thread detail        → composition with replies
├─ Event detail         → event card + RSVP + same composer
└─ Library category     → list of resources by kind

Overlay:
└─ Search               → full-bleed search with recent + suggestions
```

The shell wraps everything except detail and search overlays (which take over the viewport).
