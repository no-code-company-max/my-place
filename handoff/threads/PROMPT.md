# Prompt sugerido para Claude Code — Threads

Pegá esto en Claude Code dentro del repo. Asume que el shell ya está implementado.

---

```
Voy a implementar la slice de Threads (Discusiones) siguiendo
docs/design/threads/.

Stack: Next.js 15 (App Router), TypeScript strict, React 19, Tailwind + CSS vars,
Supabase + Prisma, TanStack Query.

Pasos:

1. Lee docs/design/threads/DESIGN_NOTES.md para layout/tokens/data shape.

2. Lee docs/design/threads/components.tsx — referencia JSX. NO copiar tal cual,
   traducir a Tailwind manteniendo CSS vars (--accent, --text, etc.).

3. Estructura de slice:
   - app/[community]/threads/page.tsx (Server Component)
     · query: top-level threads de la comunidad activa
     · ordena: featured primero, luego createdAt DESC
     · paralelo: count de replies, lista de readerIds (top 4) por thread
   - components/threads/ThreadList.tsx (Server) — recibe threads como props
   - components/threads/ThreadFilterBar.tsx (Client) — pills, estado local con
     useState (NO query param por ahora; simple)
   - components/threads/FeaturedThread.tsx (Server)
   - components/threads/ThreadRow.tsx (Server)
   - components/threads/ReaderStack.tsx (Server, 4 avatars max)
   - components/threads/EmptyThreads.tsx (Server)

4. Filter behavior:
   - Como el filter es estado local, ThreadList puede estar en el Server
     y ThreadFilterBar en Client renderiza los hijos pasados como children.
   - Patrón: ThreadFilterBar wraps un slot, ahí dentro va el listado completo
     y CSS via [data-filter] hide/show. Más simple que refetch.
   - Si querés refetch, usá TanStack Query con queryKey ['threads', communityId, filter].

5. Tipos en TypeScript estricto (ver shape en DESIGN_NOTES.md).

6. Estados:
   - Loading: Suspense + loading.tsx con 1 featured skeleton + 4 row skeletons.
   - Error: error.tsx local.
   - Empty: componente EmptyThreads.

Cuando termines mostrame:
- Estructura de archivos
- Tipos TS
- Cómo manejaste el filter (local state vs query)
```

---

## Notas adicionales

- El **avatar color** debe ser determinístico por `userId`. Hasheá el userId contra el palette `--member-1..8`. No guardar el color en DB, derivarlo.
- El **snippet** se computa en el Server: primeros 140 chars del body, sin markdown ni HTML.
- **Performance**: si la lista crece, paginá con cursor (no offset). Usá `loadMore` con TanStack Query infinite.
