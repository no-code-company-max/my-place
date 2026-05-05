# Prompt — Search

```
Voy a implementar la slice Search siguiendo docs/design/search/.

Stack: Next.js 15 App Router, TS strict, Tailwind + CSS vars,
TanStack Query, Supabase Postgres con full-text search.

Pasos:

1. Lee docs/design/search/DESIGN_NOTES.md y components.tsx.

2. UI:
   - Search no es un route propio; es un overlay state global.
   - Opciones:
     a) Route paralelo: app/[community]/@search/(.)search/page.tsx con intercept.
     b) Client modal en el shell, abierto por search icon de TopBar.
   - Recomiendo (b): más simple, no rompe scroll position.

3. Estructura:
   - components/shell/SearchOverlay.tsx (Client) — full-screen overlay
   - components/search/SearchInput.tsx (Client) — input controlado, autoFocus
   - components/search/SearchEmpty.tsx (Client) — recents + suggested
   - components/search/SearchResults.tsx (Client) — agrupado por type
   - components/search/ResultRow.tsx (Client) — switch por type
   - components/search/NoResults.tsx (Client)

4. State:
   - SearchOverlay maneja `open` global con context o zustand.
   - El icon de TopBar dispara `setOpen(true)`.

5. Backend:
   - app/api/search/route.ts:
     · query param: q, communityId
     · paralelo: events, threads, people, docs (cada uno LIMIT 6)
     · Postgres full-text con `tsvector` y `tsquery`, weighted por title > body.
     · Devolver el shape SearchResponse.
   - useQuery con queryKey ['search', communityId, debounced].
   - enabled: debounced.length > 0.

6. Recents:
   - useLocalStorage<string[]>('search-recents-{communityId}', []).
   - Helpers add(q), remove(q), clear().
   - Add se llama en onResultClick + onSubmit.

7. Keyboard:
   - Escape cierra el overlay.
   - Enter en input ejecuta búsqueda inmediata + guarda recent.
   - ↑↓ navegan resultados (out of scope v1, opcional).

Cuando termines mostrame:
- Estructura de archivos
- Endpoint /api/search/route.ts
- Cómo manejaste el state global del overlay
```

## Notas

- **No usar** `<Dialog>` con backdrop blur — el overlay debe sentirse como una pantalla nativa, no como un modal. Solid `--bg` background.
- **Animation**: fade + 8px slide-up al abrir, 120ms ease-out. Reverse al cerrar.
- **Restaurar foco**: al cerrar, devolver foco al icon de search del TopBar.
