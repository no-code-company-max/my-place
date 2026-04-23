# ADR — Shared Realtime module (Broadcast de comments · C.J)

**Fecha:** 2026-04-21
**Estado:** Aceptado
**Sub-milestone:** C.J (Fase 5 — Discussions, post-MVP)

## Contexto

Hasta C.F, el thread de un post exhibía **presence** en tiempo real
(`thread-presence.tsx`) pero **no** mostraba comments nuevos — el usuario debía
recargar o navegar. Esto era deuda deliberada registrada en
`docs/features/discussions/spec.md § 13` como "fuera del MVP — post-C.F" para
priorizar presence sin forkear state optimista vs SSR.

El gap cierra ahora por dos razones:

1. **UX**: en threads activos (≥2 miembros presentes), la conversación se
   siente fragmentada al requerir reload manual.
2. **Reuso**: próximos slices (DM, chat, eventos live) consumirán el mismo
   transport. Fase 5 es el momento de consolidar la abstracción **antes** de
   que la copia-pega acople discusiones al proveedor.

El plan ejecutable (incluyendo gaps de diseño resueltos durante revisión) está
en `.claude/plans/tidy-stargazing-summit.md`.

## Decisión

### 1. `shared/lib/realtime/` expone primitivos transport-agnostic

Interfaces `BroadcastSender` y `BroadcastSubscriber` donde `topic: string` es
opaco y el payload es `Record<string, unknown>`. **El shared nunca conoce
"comment" ni "thread"** — las features construyen sus convenciones
(`post:<id>`, futuro `dm:<convId>`). Esto respeta la regla del paradigma
(`shared/` agnostico de dominio, ver `CLAUDE.md § Paradigma`).

### 2. Transport server-side: **HTTP broadcast endpoint**, no WebSocket

`POST <SUPABASE_URL>/realtime/v1/api/broadcast` con el JWT del actor
(obtenido via `createSupabaseServer().auth.getSession()`).

- **Latencia**: ~50ms típico (single HTTP request, sin handshake).
- **RLS**: aplica idéntico a WS — Supabase valida el JWT y enforza
  `discussions_thread_send` en `realtime.messages`.
- **Simplicidad**: sin `SUBSCRIBED` state, sin unsubscribe.

### 3. Transport client-side: WebSocket via `supabase.channel().subscribe()`

Caso long-lived para el que WS existe. `SupabaseBroadcastSubscriber` recibe un
`SupabaseClient` inyectado (no importa `createSupabaseBrowser` directo) para
desacoplar el shared del path del browser factory.

### 4. Auth del emisor: cookies del actor (no service_role)

`createSupabaseServer()` usa las cookies del request. RLS aplica. Simetría con
el insert del comment — si el actor puede insertar, puede emitir. Si la sesión
falla → log warn + return (no throw, no leak de service_role key al cliente).

### 5. Best-effort: errores se tragan

Sin retries. Sin blocking. Si el broadcast falla (sin sesión, HTTP non-2xx,
network), el action **ya committed** y `revalidatePath` es la fuente
autoritaria — el user verá el comment al próximo navigate. Loguear +
swallow es la postura correcta.

### 6. UI: append local + dedupe por `commentId`

Hook `useCommentRealtime` mantiene `Set<commentId>` inicializado con SSR y
con los IDs appendeados. Sync con `initialItems` cambiante (SSR re-stream
post-`revalidatePath`): IDs nuevos del SSR se agregan al Set y se purgan de
`appendedComments` para evitar doble render.

### 7. Feature flag `DISCUSSIONS_BROADCAST_ENABLED`

Default `true`. Setear `'false'` en env desactiva el emit — sistema cae al
comportamiento pre-C.J (sólo `revalidatePath`). Rollback sin deploy.

### 8. Scope: sólo `comment_created`. 2 PRs atómicos

- **PR-1**: `shared/lib/realtime/` (400 LOC, 5 archivos impl + 5 tests).
- **PR-2**: semantic layer en `discussions/` + integración + docs.

`comment_edited`, `comment_deleted`, optimistic composer, E2E con 2 browser
contexts: agendados como follow-up en `docs/roadmap.md § Fase 5 Gaps`.

## Alternativas consideradas

### WS subscribe-then-send (server-side)

Descartada. `supabase.channel(topic).send({type:'broadcast', ...})` requiere el
canal en estado `SUBSCRIBED` — fuerza handshake + subscribe + send + unsubscribe
por cada server action (~200ms+ mínimo). Mal fit para emisiones one-shot. Queda
como fallback de emergencia si Supabase cambia el API de `/api/broadcast` (SDK
ya instalado).

### Service-role para emisión

Descartada. Requiere exponer `SUPABASE_SERVICE_ROLE_KEY` al código que corre
en server actions. Expandir la superficie que usa service-role es deuda de
seguridad — si un comment action se compromete, el attacker tiene escalation.
El JWT del user ya resuelve la autorización correctamente via RLS.

### Optimistic insert en `CommentComposer`

Agendada como follow-up UX polish. Hoy el emisor ve su comment ~300ms tras
submit (vía su propio broadcast + SSR revalidate). Agregar optimistic requiere
reconciliación con el broadcast + SSR stream — complejidad que no está
justificada en MVP.

### Broadcast emitido desde cliente (`channel.send()` post-insert)

Descartada. Permite flooding (nada impide 10k emisiones de un cliente comprometido).
El server-side emit es el único path que pasa por RLS consistentemente y
tiene observabilidad (logs pino del action).

## Rollback plan

Setear `DISCUSSIONS_BROADCAST_ENABLED=false` en el env del runtime (Vercel env,
`.env.production.local` en selfhosting). `broadcastNewComment` loguea
`commentBroadcastDisabled` + return — sistema cae al comportamiento
pre-C.J sin deploy.

Si el problema es **structural** (API drift de Supabase `/api/broadcast`,
abuso de quota), remover el call a `broadcastNewComment` en
`src/features/discussions/server/actions/comments/create.ts` es trivial — es
una línea entre `insertCommentTx` y `revalidateCommentPaths`.

## Observabilidad

Eventos estructurados pino:

- `commentBroadcastEmitted` (debug): emisión exitosa. Campos: `postId`,
  `commentId`.
- `commentBroadcastFailed` (warn): error en el helper semántico. Campos:
  `postId`, `commentId`, `err`.
- `commentBroadcastDisabled` (debug): feature flag off. Campos: `postId`,
  `commentId`.
- `broadcastSendSkipped` (warn): shared sender no pudo resolver sesión.
  Campos: `topic`, `broadcastEvent`, `reason`.
- `broadcastSendFailed` (warn): shared sender recibió HTTP non-2xx o fetch
  rejection. Campos: `topic`, `broadcastEvent`, `status` o `err`.

Futuro: telemetría agregada de emit/fail rate agendada como follow-up en
`docs/roadmap.md § Fase 5 Gaps`.

## Consecuencias

- Los slices futuros (DM, chat, eventos) consumen `shared/lib/realtime/server`
  (send) y `shared/lib/realtime/client` (subscribe) — barrels separados para
  que el bundler nunca arrastre sender al bundle cliente.
- `thread-presence.tsx` hoy usa `supabase.channel()` inline; migrarlo a
  `SupabaseBroadcastSubscriber` es refactor agendado, no bloqueante.
- `realtime.messages` policies existentes (migration
  `20260424000000_realtime_discussions_presence`) cubren tanto presence como
  broadcast — sin cambios SQL necesarios.
- `private: true` en subscribe y en payload HTTP es obligatorio; el toggle
  "Allow public access to channels" en Supabase Dashboard debe estar OFF en
  cada ambiente (ya documentado en `CLAUDE.md § Gotchas`).

## Archivos clave

- `src/shared/lib/realtime/types.ts` — interfaces
- `src/shared/lib/realtime/supabase-sender.ts` — impl HTTP endpoint (server-only)
- `src/shared/lib/realtime/supabase-subscriber.ts` — impl WS subscribe (client)
- `src/shared/lib/realtime/fake-sender.ts` / `fake-subscriber.ts` — test doubles
- `src/shared/lib/realtime/sender-provider.ts` — factory con override para tests
- `src/shared/lib/realtime/server.ts` / `client.ts` — barrels separados
- `src/features/discussions/server/realtime.ts` — semantic layer
  (`broadcastNewComment`) con feature flag + log structured
- `src/features/discussions/ui/use-comment-realtime.ts` — hook con dedupe
- `src/features/discussions/ui/comment-thread-live.tsx` — wrapper client

## Referencias

- `docs/features/discussions/spec.md § 13` — contrato de realtime actualizado
- `docs/realtime.md` — regla de oro (dónde sí, dónde no)
- `prisma/migrations/20260424000000_realtime_discussions_presence/` — policies
- `CLAUDE.md § Gotchas` — toggle "Allow public access to channels" OFF
