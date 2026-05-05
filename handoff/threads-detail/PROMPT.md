# Prompt — Thread Detail

Asume que la slice Threads ya está implementada.

---

```
Voy a implementar la slice de Thread Detail siguiendo
docs/design/threads-detail/.

Stack: Next.js 15 App Router, TS strict, React 19, Tailwind + CSS vars,
Supabase + Prisma, TanStack Query.

Pasos:

1. Lee docs/design/threads-detail/DESIGN_NOTES.md y components.tsx.

2. Estructura:
   - app/[community]/threads/[threadId]/page.tsx (Server Component)
     · query thread + replies en paralelo (Promise.all)
     · readerSample = 5 random/recent reader avatars
   - components/thread-detail/ThreadHeaderBar.tsx (Client) — back button con router
   - components/thread-detail/ThreadBody.tsx (Server) — title + author + markdown body
   - components/thread-detail/ActionRow.tsx (Client) — like, scroll-to-replies, share
   - components/thread-detail/ReplyList.tsx (Server)
   - components/thread-detail/Reply.tsx (Server) — incluye QuoteBlock si quoteOf existe
   - components/thread-detail/QuoteBlock.tsx (Server)
   - components/thread-detail/Composer.tsx (Client) — textarea + mutación

3. Mutaciones (TanStack Query):
   - useToggleLike(threadId | replyId)
   - useSendReply(threadId, { body, quoteOf? })
     · Optimistic: insertar reply temp con id 'temp-{uuid}', estado pending.
     · onError: rollback con toast "no se pudo enviar".
     · onSuccess: reemplazar temp por server reply, smooth-scroll.

4. Citas:
   - Long-press en mobile: usar timer + touchstart/touchend (300ms hold).
   - Desktop: contextmenu + onClick fallback.
   - Menú: Radix Popover o Headless UI (no dependencies nuevas si ya tenés Radix).

5. Markdown:
   - Si ya hay un renderer en el repo, usalo.
   - Sino, react-markdown + remark-gfm + sanitize-html.

6. Estados:
   - Loading: title skeleton + body skeleton + 3 reply skeletons.
   - Error: error.tsx con "No se pudo cargar la discusión" + retry.
   - Empty replies: texto centrado, sin CTA.

Cuando termines mostrame:
- Estructura de archivos
- Tipos TS
- Cómo manejaste el long-press para citar
```

---

## Notas

- El **composer es Client**, todo lo demás Server. Si la mutación necesita refrescar el server tree, usá `router.refresh()` en `onSuccess` (después del swap optimista).
- **No mostrar el shell** (TopBar/Dots) en esta vista. Es un layout especial — `app/[community]/threads/[threadId]/layout.tsx` puede no incluir el shell, solo el header propio.
- **Persistir scroll position** al volver: usá `sessionStorage` con key `thread-list-scroll-{communityId}`.
