# presence/

Sub-slice de `discussions/`. Tracking de "quién leyó qué y cuándo" + presencia en vivo de viewers en un thread.

## Componentes (UI)

- `DwellTracker` (client): mide tiempo del viewer en el post; dispara `markPostReadAction` tras 5s continuos.
- `ThreadPresence` (client, lazy): wrapper `React.lazy` + `requestIdleCallback` sobre el componente real; avatares en vivo via Supabase Realtime presence (~12-15 kB gzip post-FCP).
- `PostReadersBlock` (Server Component): renderiza la lista "X leyeron" en el detail.
- `ReaderStack` (UI puro): primitivo de avatares overlapping.
- `PostUnreadDot` (UI puro): indicador visual de "no leído".

## Server (`public.server.ts`)

- `findOrCreateCurrentOpening(placeId)`: resuelve la apertura activa del place.
- `listReadersByPost(postId, opts)`: lectores del post para el bloque del detail.
- Helpers consumidos por `posts/server/queries/posts.ts` para hidratar el listado:
  - `fetchLastReadByPostId`
  - `fetchCommentCountByPostId`
  - `fetchReadersSampleByPostId`
- Tipo `PostReader` exportado.

## Action

- `markPostReadAction` (`'use server'`): UPSERT idempotente en `PostRead`, monótono sobre `(postId, userId, placeOpeningId)`. Contrato + semántica en el JSDoc del archivo y en `docs/decisions/2026-04-20-post-read-upsert-semantics.md`.

## Boundaries

- Consumo externo SÓLO via `discussions/public.ts` (UI/action) y `discussions/public.server.ts` (queries server-only). Nada importa directo de `presence/` desde fuera del slice.
- Cross-sub-slice interno: `posts/server/queries/posts.ts` consume helpers de `presence/server/queries/post-readers.ts`. Acoplamiento documentado como F2 en el plan padre.

## Realtime

Topic `post:<id>:presence`, separado del broadcast `post:<id>` para evitar el bug `cannot add presence callbacks` de supabase-js (mezclar `presence` + `broadcast` en el mismo channel rompe el join). Ver ADR `docs/decisions/2026-05-09-realtime-presence-topic-split.md`.

## Origen

Plan de migración + creación del sub-slice: `docs/plans/2026-05-09-presence-subslice-migration.md`.
