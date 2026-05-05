# Thread Detail

Push view from a thread row. Shows the full thread + replies + composer.

## Layout

```
┌────────────────────────────────────┐
│ ‹ atrás                       •••  │ ← header bar
├────────────────────────────────────┤
│                                    │
│ [LM] Lucía M. · hace 2 h           │
│                                    │
│ ¿Alguien sabe del corte de         │ ← Fraunces 700 / 28
│ agua?                              │
│                                    │
│ Estoy sin agua desde esta mañana   │ ← Inter / 16, full body
│ en el edificio B. ¿Pasa en otros?  │
│                                    │
│ [♥ 4]  [💬 14]  [↗ Compartir]      │ ← actions row
│                                    │
│ [stack avatars]  18 leyeron        │
│                                    │
├──── 14 respuestas ─────────────────┤
│                                    │
│ [DR] Diego R. · hace 1 h           │
│ Sí, también me pasa en el A.       │
│                                    │
│ [AP] Ana P. · hace 45 min          │
│ ┌─ "Sí, también me pasa en el A." │ ← cited reply
│ │                                  │
│ Ya está reportado a Aysa.          │
│                                    │
│ ...                                │
│                                    │
└────────────────────────────────────┘
[ Composer pinned to bottom ]        ← inline reply
```

## Header

- 56px tall, sticky, `--bg` background, 0.5px hairline at bottom.
- Left: back chevron + "atrás" (text optional, just chevron is fine).
- Right: overflow `•••` (Reportar, Silenciar, etc — out of scope for v1).

## Body

- Author row (avatar + name + time), same component as in Threads list.
- Title: Fraunces 700 / 28, `text-wrap: balance`.
- Body: Inter 400 / 16, line-height 1.55. Render markdown if your stack supports it.
- **Action row**: 3 buttons — like, jump-to-replies, share. Icon + count, no labels.
- **Readers**: stacked avatars (up to 5) + "X leyeron".

## Replies

- Section header: thin "{n} respuestas".
- Each reply: avatar 28×28 + name + time + body (Inter / 14.5 / 1.55).
- **Citing**: if a reply quotes another, show the quoted block above the body — left border 2px `--accent`, italic, muted, 1 line clamp + "ver más".
- 0.5px hairline between replies.

## Composer (bottom-fixed)

- Pinned to bottom of viewport (over the safe area / home indicator).
- Background `--surface`, top hairline `--border`.
- Layout: 36×36 author avatar (left) + textarea (auto-grow) + send button (`--accent` bg) (right).
- If user is "quoting" a reply (long-press menu), show a small dismissable chip above the textarea with the quoted text.
- Sends on tap of send or Cmd/Ctrl+Enter.

## Behavior

- Optimistic insert on send (TanStack Query mutation with `onMutate`).
- Scroll to bottom on send.
- Close: back navigates to `/[community]/threads` and restores scroll position.

## States

- **Loading**: title skeleton + 3 reply skeletons.
- **Error**: error.tsx local.
- **Empty replies**: "Todavía nadie respondió. Sé el primero." (no CTA, just text — composer is always there).
