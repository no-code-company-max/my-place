# threads/

Sub-slice de `discussions/`. UI del listing de threads del place (lista de conversations).

## Componentes (UI)

- `ThreadHeaderBar` (client): top bar del detail de un thread (back button + slot derecho para acciones admin/event).
- `PostList` (Server Component): renderiza el chrome de `/conversations` (featured + threads apilados + filter pills + empty state + paginación).
- `FeaturedThreadCard` (UI): card del primer post de la lista (border + padding + chrome distinto al row).
- `ThreadRow` (UI): fila apilada en el listing (resto de posts).
- `LoadMorePosts` (client): botón "Ver más discusiones" + invoca `loadMorePostsAction`.
- `EmptyThreads` (UI): estado vacío contextual al filtro activo.
- `ThreadFilterPills` (client): pills de filtros (`Todos`, `Sin respuesta`, `En los que participo`).
- `ThreadsSectionHeader` (UI): header chico del bloque de threads.

## Server

Sin server-only exports propios. La query principal del listing (`listPostsByPlace`) y el action de paginación (`loadMorePostsAction`) viven en `discussions/server/` raíz y se consumen via path absoluto.

## Boundaries

- Consumo externo SÓLO via `discussions/public.ts` (`ThreadHeaderBar`) y `discussions/public.server.ts` (`PostList`). Nada importa directo de `threads/` desde fuera del slice.
- Cross-sub-slice interno: `featured-thread-card` y `thread-row` consumen `ReaderStack` + `PostUnreadDot` desde `discussions/presence/public`. Acoplamiento legítimo (presence es lo que renderea per-row el dot/stack).

## Streaming + bundle

`PostList` es Server Component renderizado bajo el shell de `/conversations` — se streama con SSR. `LoadMorePosts` es Client Component con server action para paginar; el chunk client se carga al montar el botón (no eager).

Bundle baseline `/conversations`: 290 kB First Load JS.

## Origen

Plan de consolidación: `docs/plans/2026-05-09-threads-subslice-migration.md`. Audit previo a ejecución: `docs/plans/2026-05-09-threads-subslice-migration-audit.md`. Ejecutado en commits B.3.1-B.3.5 (~600 LOC bajados del raíz).
