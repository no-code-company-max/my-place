# Análisis exploratorio — B.4 (`discussions/posts/`) y B.5 (`discussions/comments/`)

**Fecha:** 2026-05-09 (post-commit `5e4e596`, B.2c deployed)
**Owner del análisis:** sesión read-only de planificación
**Estado base:** `discussions` raíz = 6176/1500 LOC (sub-slices ya consolidados: `presence`, `reactions`, `composers`, `moderation`).

---

## Resumen ejecutivo (TL;DR)

Estas dos migraciones **no se parecen a B.1-B.2** (que fueron clones byte-a-byte). Los sub-slices `posts/` y `comments/` están **frozen desde el 6 de mayo** (commit `f666f4d`, foundation rich-text). Mientras tanto el legacy raíz recibió múltiples features y fixes:

- **G.3 atomic permissions** (`hasPermission(...,'discussions:delete-post')`, `hasPermission(...,'discussions:hide-post')`, `findPlaceOwnership` para edit) — sub-slice TIENE la migración G.3, **legacy NO** (legacy usa el viejo `actor.isAdmin`/`canAdminHide`).
- **F.3 RichTextRenderer Lexical** — legacy `comment-item.tsx` ya renderiza el body, **sub-slice todavía muestra placeholder F.1** "Contenido temporalmente deshabilitado durante migración a Lexical".
- **Audit #5 snapshot validation** — legacy `create.ts` (posts y comments) valida `authorSnapshot`/`quoteSnapshot` con Zod pre-insert; sub-slice **NO**.
- **Audit #3 broadcast post_hidden** — legacy `moderate.ts` dispara `broadcastPostHidden(post.id)` en hide; sub-slice lo eliminó.
- **CommentView shape** — sub-slice agregó `quoteState: QuoteTargetState | null` al view (con JOIN en la query); legacy lo computa fuera con `resolveQuoteTargetStates` en `_comments-section.tsx`.
- **Lazy realtime appender** — legacy `comment-thread-live.tsx` carga el subscriber Supabase post-FCP via `React.lazy + requestIdleCallback` (~12-15 kB gzip); sub-slice eagerly importa el hook.
- **revalidate paths** — legacy revalida `/${placeSlug}` (home); sub-slice lo eliminó con comentario "no consume queries de discussions".

**Conclusión upfront:** estas no son migraciones de "borrar copia stale". Son **mergeo bidireccional**: el sub-slice tiene la verdad (G.3), el legacy tiene la verdad (F.3, snapshot validation, post_hidden broadcast, revalidate /home, lazy realtime, quoteState externo). **Nadie es la fuente única — hay que reconciliar feature-por-feature antes de borrar nada.**

Esto cambia la estimación de esfuerzo en órdenes de magnitud vs B.2. No se aborda como "rewire + delete". Se aborda como mini-refactor de cada concern.

---

## B.4 — `discussions/posts/`

### 1. Qué hay hoy en el sub-slice

`/Users/maxi/claude-workspace/place/src/features/discussions/posts/`:

| Archivo                                  | LOC | Estado                                                                                                                                                                              |
| ---------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.ts`                              | 16  | exporta 6 actions; **NO** lo importa nadie externo                                                                                                                                  |
| `public.server.ts`                       | 14  | exporta `findPostById`, `findPostBySlug`, `listPostsByPlace`, `POST_PAGE_SIZE`, `createPostFromSystemHelper`; sólo lo importa `presence/__tests__/post-event-relation.test.ts`      |
| `server/queries/posts.ts`                | 262 | superset funcional del legacy; importa `fetchCommentCountByPostId/fetchLastReadByPostId/fetchReadersSampleByPostId` desde `presence/public.server` (acoplamiento F2 ya documentado) |
| `server/actions/create.ts`               | 100 | difiere del legacy: **falta** snapshot Zod validation                                                                                                                               |
| `server/actions/create-from-system.ts`   | 110 | **byte-idéntico** al legacy                                                                                                                                                         |
| `server/actions/delete.ts`               | 114 | **G.3 atomic permission** (`hasPermission(...,'discussions:delete-post')`); legacy usa `actor.isAdmin`                                                                              |
| `server/actions/edit.ts`                 | 241 | **G.3 + ADR #2 owner-only bypass** (`findPlaceOwnership`); legacy usa `actor.isAdmin`                                                                                               |
| `server/actions/moderate.ts`             | 82  | **G.3 atomic permission** (`hasPermission(...,'discussions:hide-post')`); legacy usa `canAdminHide`. **Sub-slice eliminó `broadcastPostHidden(post.id)`**                           |
| `server/actions/shared.ts`               | 55  | sub-slice eliminó `revalidatePath('/${placeSlug}')` (con comentario "home placeholder estático")                                                                                    |
| `server/actions/index.ts`                | 11  | re-exports                                                                                                                                                                          |
| `__tests__/posts-actions.test.ts`        | 669 | difiere: usa mocks **G.3** (groupMembership.findMany)                                                                                                                               |
| `__tests__/list-posts-filter.test.ts`    | 161 | difiere: mocks pre-presence-migration                                                                                                                                               |
| `__tests__/list-posts-last-read.test.ts` | 259 | difiere similar                                                                                                                                                                     |

**Total `discussions/posts/`:** 1004 LOC prod (verificado con `pnpm tsx scripts/lint/check-slice-size.ts`).

**Cableo al raíz:** **CERO**. Ningún archivo de la slice raíz importa de `discussions/posts/*`. La única excepción es el orphan `presence/__tests__/post-event-relation.test.ts` (F1 ya documentado).

### 2. Qué hay en el legacy raíz (posts-related)

Lo que B.4 borraría (parcialmente):

| Origen legacy                                     | LOC       | Comentario                                                                                                                                                                                  |
| ------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/queries.ts` líneas 33-319 (posts portion) | ~287      | `findPostById`, `findPostBySlug`, `listPostsByPlace`, `buildFilterWhere`, `fetchLastReadByPostId`, `fetchCommentCountByPostId`, `fetchReadersSampleByPostId`, `mapPost`, `mapPostWithEvent` |
| `server/actions/posts/*.ts`                       | 705       | 7 archivos (create, create-from-system, delete, edit, moderate, shared, index) wireados por `public.ts:81-87` y `public.server.ts:18`                                                       |
| `server/actions/load-more.ts` posts portion       | ~63       | `loadMorePostsAction` + schema; `loadMoreCommentsAction` ya importa de sub-slice comments queries                                                                                           |
| **Total directamente eliminable**                 | **~1055** | Si el sub-slice fuera adoptado completamente y reconciliado                                                                                                                                 |

**Nota importante:** los 3 helpers `fetchLastReadByPostId/fetchCommentCountByPostId/fetchReadersSampleByPostId` ya están duplicados en el sub-slice presence (`presence/server/queries/post-readers.ts`). El sub-slice posts importa los del presence (cross-sub-slice public). Borrar las copias en `queries.ts` legacy ya es seguro **post B.1** — solo `listPostsByPlace` legacy las consume hoy, y desaparece con B.4.

### 3. Diffs entre legacy y sub-slice — Sample concreto

**`server/actions/posts/delete.ts`:**

```diff
+ import { hasPermission } from '@/features/members/public.server'
- authorizePostDelete(actor, post, now)
+ const canModerate = await hasPermission(actor.actorId, actor.placeId, 'discussions:delete-post')
+ authorizePostDelete(actor, post, now, canModerate)
```

**`server/actions/posts/edit.ts`:**

```diff
+ import { findPlaceOwnership } from '@/shared/lib/identity-cache'
- if (!actor.isAdmin) {
+ // G.3 (decisión ADR #2): editar contenido ajeno NO es permiso atómico delegable.
+ const isOwner = await findPlaceOwnership(actor.actorId, actor.placeId)
+ if (!isOwner) {
```

**`server/actions/posts/moderate.ts`:**

```diff
- import { canAdminHide } from '@/features/discussions/domain/invariants'
+ import { hasPermission } from '@/features/members/public.server'
- import { broadcastPostHidden } from '@/features/discussions/server/realtime'

- if (!canAdminHide(actor)) {
+ const allowed = await hasPermission(actor.actorId, actor.placeId, 'discussions:hide-post')
+ if (!allowed) {

- if (mode === 'hide') {
-   await broadcastPostHidden(post.id)
- }
```

**`server/actions/posts/create.ts`:**

```diff
- import { assertSnapshot, authorSnapshotSchema } from '@/features/discussions/domain/snapshot-schemas'
- // Audit #5: validamos el authorSnapshot pre-insert.
- const authorSnapshot = assertSnapshot(buildAuthorSnapshot(actor.user), authorSnapshotSchema)
+ authorSnapshot: buildAuthorSnapshot(actor.user) as Prisma.InputJsonValue,
```

**`server/actions/posts/shared.ts`:**

```diff
- revalidatePath(`/${placeSlug}`)
```

### 4. Consumidores externos

**De `findPostById`/`findPostBySlug`/`listPostsByPlace`/`Post`/types Post-relacionados (vía `discussions/public.server`):**

| Consumer                                                                      | Importa                   |
| ----------------------------------------------------------------------------- | ------------------------- |
| `app/[placeSlug]/(gated)/conversations/page.tsx`                              | `listPostsByPlace`        |
| `app/[placeSlug]/(gated)/conversations/[postSlug]/page.tsx`                   | `findPostBySlug`          |
| `app/[placeSlug]/(gated)/conversations/[postSlug]/_thread-content.tsx`        | `PostDetail`, `type Post` |
| `app/[placeSlug]/(gated)/conversations/[postSlug]/_thread-header-actions.tsx` | `type Post`               |

**De actions de Posts (vía `discussions/public`):**

| Consumer                                                 | Importa                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `discussions/ui/post-admin-menu.tsx` (legacy)            | `deletePostAction, hidePostAction, unhidePostAction` desde `../server/actions/posts` |
| `discussions/moderation/ui/post-admin-menu.tsx` (orphan) | mismas, pero desde `posts/public`                                                    |

**Cross-slice:**

- `events/server/actions/create.ts`, `events/editor/server/actions/create.ts`, `library/items/server/actions/create-item.ts` → `createPostFromSystemHelper` (vía `discussions/public.server`)
- `flags/server/actions.ts`, `flags/server/actions/review.ts` → `hardDeletePost` (vía `discussions/public.server`, NO migrable a sub-slice posts hoy: vive en `server/hard-delete.ts` raíz)

### 5. Acoplamiento cross-sub-slice

- **F2 confirmado:** `posts/server/queries/posts.ts:13-17` importa los 3 helpers privados de `presence/public.server.ts`. **No es desacoplable sin DI** porque la lógica de `fetchReadersSampleByPostId` requiere `findOrCreateCurrentOpening` que es del dominio presence. Decisión: aceptar el acoplamiento (es legítimo: `PostListView` mezcla shape de Post + presence aggregations).
- `posts/server/actions/delete.ts` importa `hasPermission` de `@/features/members/public.server` (G.3). Cross-slice válido.
- `posts/server/actions/edit.ts` importa `findPlaceOwnership` de `@/shared/lib/identity-cache`. Sin issue.

### 6. Mejora reportada por B.4

**LOC del raíz post-migración (estimación realista):**

- Borrar posts portion de `queries.ts`: -287 LOC (queda el archivo con sólo comments-related).
- Borrar `server/actions/posts/*.ts` (7 archivos): -705 LOC.
- Migrar `load-more.ts` al sub-slice (split posts vs comments): -63 LOC en raíz, +63 en sub-slice o +75 si se separa `loadMorePostsAction` aparte.
- **Bajada bruta del raíz: ~1055 LOC** (de 6176 → ~5121).
- **Cap 1500 sigue violado por -3621 LOC.** No cierra la excepción, ni de cerca.

**Beneficios cualitativos:**

1. **G.3 + ADR #2 + Audit #3 + Audit #5** dejan de tener dos sources of truth (legacy ≠ sub-slice). HOY el código que ejecuta es el legacy, así que el sub-slice es **deuda muerta**. B.4 obliga a **decidir cuál es la fuente correcta** — preservar G.3 del sub-slice + reconciliar Audit #5 + reconciliar la decisión sobre `broadcastPostHidden` + reconciliar revalidate `/${placeSlug}`.
2. Predecibilidad: cualquier sesión que toque posts va a una sola ubicación.
3. Cohesión: queries + actions + create-from-system juntos en `posts/`.

**Trade-offs / riesgos:**

- **Riesgo #1 (alto):** la reconciliación del feature G.3 requiere entender por qué el sub-slice tiene G.3 y el legacy no. ¿Hubo un revert? ¿Una rama paralela? Si la respuesta es "el sub-slice se quedó atrás del legacy en G.3", entonces B.4 no es delete-and-replace — es **portar G.3 al legacy primero** y luego unificar.
- **Riesgo #2 (alto):** `broadcastPostHidden` es feature post-launch (commit `efcf621` "broadcast post_hidden + watcher cliente"). Si B.4 mueve la copia sin esta funcionalidad, regresiona el comportamiento de hide en runtime — sin warning.
- **Riesgo #3 (medio):** `Audit #5 snapshot validation` es defensa contra refactors futuros. Removerla en B.4 reduce la red de seguridad.
- **Riesgo #4 (medio):** `revalidatePath('/${placeSlug}')`: el sub-slice asume "home es placeholder Fase 7". Verdadero hoy. Pero si Fase 7 se acerca, esto vuelve a importar.

### 7. Complejidad y dependencias

- **Dependencia con B.3 (threads):** parcial. `discussions/threads/ui/load-more-posts.tsx` importa `loadMorePostsAction` de `discussions/server/actions/load-more`. Si B.4 migra `loadMorePostsAction` al sub-slice posts, B.3 (que migra el listing UI) tiene que apuntar al nuevo path. Mejor coordinar: **B.3 antes que B.4** OR ambos en sesiones consecutivas.
- **Transacciones cross-sub-slice:** `loadMorePostsAction` mezcla posts (legacy) + comments (sub-slice). Si B.4 lo migra, hay que decidir dónde vive (`posts/` parece natural para `loadMorePostsAction` y `comments/` ya tiene su `loadMoreCommentsAction` análogo — el archivo `load-more.ts` actual debería partirse).
- **Tests E2E:** existen tests RLS (`post-read.test.ts`, `helpers-realtime.test.ts`) que tocan posts, pero ninguno depende del path del módulo (mock por path). Riesgo bajo.

### 8. Estimación de esfuerzo

**Comparado con B.1/B.2:** B.1+B.2 cerraron en ~75min cada uno PORQUE eran "rewire + delete clones". B.4 NO es eso. La reconciliación G.3/Audit #5/broadcastPostHidden/revalidate es donde se pierde el tiempo.

**Estimación realista:** **3.5-5 horas efectivas**, splittable en:

| Sub-fase     | Trabajo                                                                                                                                                | Estimado       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| Pre-flight   | Decidir source of truth feature por feature (G.3, Audit #5, post_hidden, revalidate)                                                                   | 30 min         |
| B.4.0        | Reconciliar sub-slice: portar Audit #5 + restore `broadcastPostHidden` + restore `revalidatePath` (commits dirigidos al sub-slice **antes** de wirear) | 60-90 min      |
| B.4.1        | Re-wire `discussions/public.ts` actions a `posts/public`                                                                                               | 30 min + smoke |
| B.4.2        | Re-wire `discussions/public.server.ts` queries + `Post` type a `posts/public.server`                                                                   | 30 min         |
| B.4.3        | Migrar `loadMorePostsAction` al sub-slice                                                                                                              | 30 min         |
| B.4.4        | Borrar legacy: `server/actions/posts/`, posts portion de `queries.ts`, posts portion de `load-more.ts`                                                 | 30 min         |
| B.4.5        | Borrar tests legacy duplicados (post-event-relation, posts-actions, list-posts-filter, list-posts-last-read)                                           | 15 min         |
| Smoke + docs |                                                                                                                                                        | 30 min         |

**Commits razonables:** 5-6 (uno por sub-fase, granularidad reversible).

---

## B.5 — `discussions/comments/`

### 1. Qué hay hoy en el sub-slice

`/Users/maxi/claude-workspace/place/src/features/discussions/comments/`:

| Archivo                                                      | LOC      | Estado                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `public.ts`                                                  | 27       | exporta 6 UI components + 4 actions + `useCommentRealtime`; **NO** lo importa nadie externo                                                                                                                                                    |
| `public.server.ts`                                           | 11       | exporta `findCommentById`, `listCommentsByPost`, `CommentView`, `COMMENT_PAGE_SIZE`                                                                                                                                                            |
| `server/queries/comments.ts`                                 | 134      | **drift en CommentView**: agrega `quoteState: QuoteTargetState                                                                                                                                                                                 | null` con JOIN |
| `server/actions/create.ts`                                   | 155      | **falta** Audit #5 snapshot validation; revalidateCommentPaths(.,.,'create') con kind                                                                                                                                                          |
| `server/actions/delete.ts`                                   | 102      | **G.3 atomic permission** (`hasPermission`); legacy usa `actor.isAdmin`                                                                                                                                                                        |
| `server/actions/edit.ts`                                     | 164      | refactor: deja de usar `assertCommentAlive` extraído, inline                                                                                                                                                                                   |
| `server/actions/shared.ts`                                   | 39       | nueva firma `revalidateCommentPaths(slug, postSlug, kind)` con tres-vías condicional; legacy 2-arg sin kind                                                                                                                                    |
| `server/actions/index.ts`                                    | 10       | re-exports                                                                                                                                                                                                                                     |
| `ui/comment-admin-menu.tsx`                                  | 125      | difiere SOLO en imports                                                                                                                                                                                                                        |
| `ui/comment-item.tsx`                                        | 129      | **MASSIVE DRIFT**: legacy F.3 con `RichTextRenderer` + `mentionResolvers` + `quoteTargetState` prop; sub-slice F.1 stub "Contenido temporalmente deshabilitado". Sub-slice usa `comment.quoteState` (del CommentView), legacy usa prop externo |
| `ui/comment-thread.tsx`                                      | 96       | difiere: sub-slice no acepta `quoteStateByCommentId` ni `mentionResolvers`                                                                                                                                                                     |
| `ui/comment-thread-live.tsx`                                 | 55       | **MASSIVE DRIFT**: legacy lazy-load del realtime appender (chunk Supabase post-FCP, ~12-15 kB ahorro First Load); sub-slice eagerly importa `useCommentRealtime` directamente                                                                  |
| `ui/load-more-comments.tsx`                                  | 104      | difiere: import de tipos cambiado, falta deserializeComment helper                                                                                                                                                                             |
| `ui/quote-button.tsx`, `quote-preview.tsx`, `quote-store.ts` | 36/37/28 | byte-similar (sólo imports)                                                                                                                                                                                                                    |
| `ui/use-comment-realtime.ts`                                 | 104      | byte-idéntico salvo import                                                                                                                                                                                                                     |
| `__tests__/comments-actions.test.ts`                         | 557      | diff substancial: mocks G.3 (groupMembership.findMany)                                                                                                                                                                                         |
| `__tests__/use-comment-realtime.test.tsx`                    | 176      | diff trivial                                                                                                                                                                                                                                   |

**Total `discussions/comments/`:** 1354 LOC prod.

**Cableo al raíz:** **CERO**. Sólo `discussions/server/queries/index.ts` (orphan, no importado) re-exporta del sub-slice. `discussions/server/actions/load-more.ts:11-13` importa `listCommentsByPost` y `CommentView` desde el sub-slice — **ya consume el sub-slice para load-more**.

### 2. Qué hay en el legacy raíz (comments-related)

| Origen legacy                                                                           | LOC          | Comentario                                                                                             |
| --------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| `server/queries.ts` líneas 320-479 (comments portion)                                   | ~160         | `findCommentById`, `findQuoteSource`, `listCommentsByPost`, `mapComment`, `CommentView`, `QuoteSource` |
| `server/actions/comments/*.ts`                                                          | 556          | 5 archivos (create, delete, edit, shared, index) wireados por `public.ts:90-94`                        |
| `server/actions/load-more.ts` comments portion                                          | ~63          | `loadMoreCommentsAction` (ya consume sub-slice query)                                                  |
| `ui/comment-admin-menu.tsx`                                                             | 125          | wireado por nadie externo, sólo otros UI files legacy                                                  |
| `ui/comment-composer-form.tsx`                                                          | 74           | wireado por `composers/` — fuera de scope B.5                                                          |
| `ui/comment-composer-lazy.tsx`                                                          | 89           | idem                                                                                                   |
| `ui/comment-item-client.tsx`                                                            | 82           | wireado por `comment-item.tsx` (renderer client)                                                       |
| `ui/comment-item.tsx`                                                                   | 137          | wireado por `comment-thread.tsx`; **F.3 RichTextRenderer enabled** (única ubicación enabled)           |
| `ui/comment-realtime-appender.tsx`                                                      | 39           | usado por lazy chunk de `comment-thread-live.tsx` legacy                                               |
| `ui/comment-thread-live.tsx`                                                            | 77           | wireado por `comment-thread.tsx` (Suspense lazy)                                                       |
| `ui/comment-thread.tsx`                                                                 | 112          | wireado por `public.server.ts:76`                                                                      |
| `ui/load-more-comments.tsx`                                                             | 95           | wireado por `comment-thread.tsx`                                                                       |
| `ui/quote-button.tsx`, `quote-preview.tsx`, `quote-store.ts`, `use-comment-realtime.ts` | 36+37+28+104 | wireados internamente                                                                                  |
| **Total directamente eliminable (sin reconciliación)**                                  | **~1814**    | si todas las copias del sub-slice se promueven sin más                                                 |

### 3. Diffs entre legacy y sub-slice — Sample concreto

**`server/queries/comments.ts` shape change:**

```typescript
// Legacy (queries.ts):
export type CommentView = Omit<Comment, 'body'> & { body: LexicalDocument | null }

// Sub-slice:
export type CommentView = Omit<Comment, 'body'> & {
  body: LexicalDocument | null
  quoteState: QuoteTargetState | null // <-- nuevo, computado vía JOIN
}
```

**`server/actions/comments/delete.ts`:**

```diff
+ import { hasPermission } from '@/features/members/public.server'
- if (canDeleteContent(actor, comment.authorUserId, comment.createdAt, now)) return
+ const canModerate = await hasPermission(actor.actorId, actor.placeId, 'discussions:delete-comment')
+ if (canDeleteContent({...actor, isAdmin: canModerate}, comment.authorUserId, comment.createdAt, now)) return
```

**`server/actions/comments/shared.ts`:**

```diff
- export function revalidateCommentPaths(placeSlug: string, postSlug: string): void {
-   revalidatePath(`/${placeSlug}`)
-   revalidatePath(`/${placeSlug}/conversations`)
-   revalidatePath(`/${placeSlug}/conversations/${postSlug}`)
- }
+ type CommentRevalidateKind = 'create' | 'edit' | 'delete'
+ export function revalidateCommentPaths(placeSlug: string, postSlug: string, kind: CommentRevalidateKind): void {
+   revalidatePath(`/${placeSlug}/conversations/${postSlug}`)
+   if (kind !== 'edit') {
+     revalidatePath(`/${placeSlug}/conversations`)
+   }
+ }
```

**`ui/comment-item.tsx` (RichText render):**

```diff
// Legacy (working today, F.3):
- <RichTextRenderer document={comment.body} resolvers={mentionResolvers} />

// Sub-slice (F.1 stub, broken UX):
+ <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
+   Contenido temporalmente deshabilitado durante migración a Lexical (F.1). Se restaura en F.3.
+ </div>
```

**`ui/comment-thread-live.tsx` (perf/bundle drift):**

```diff
// Legacy: lazy import + requestIdleCallback gate
- const CommentRealtimeAppender = lazy(() => import('./comment-realtime-appender').then(...))
- const [armed, setArmed] = useState(false)
- useEffect(() => { /* requestIdleCallback */ setArmed(true) })
- {armed ? <Suspense><CommentRealtimeAppender ... /></Suspense> : null}

// Sub-slice: eager hook, no chunk split
+ const { appendedComments } = useCommentRealtime({ postId, initialItems })
+ {appendedComments.map(comment => <CommentItem ... />)}
```

### 4. Consumidores externos

**De `findCommentById`/`listCommentsByPost`/`CommentView` (vía `discussions/public.server`):**

| Consumer                                                                          | Importa                               |
| --------------------------------------------------------------------------------- | ------------------------------------- |
| `app/[placeSlug]/(gated)/conversations/[postSlug]/_comments-section.tsx`          | `listCommentsByPost`, `CommentThread` |
| `app/[placeSlug]/(gated)/library/[categorySlug]/[itemSlug]/_comments-section.tsx` | mismas                                |

**De UI Comment components (vía `discussions/public.server`):**

| Consumer                                | Importa         |
| --------------------------------------- | --------------- |
| `_comments-section.tsx` (conversations) | `CommentThread` |
| `_comments-section.tsx` (library)       | `CommentThread` |

**De actions (vía `discussions/public`):**

- `discussions/composers/...` (sub-slice, vía `comments/public` indirecto): `CommentAdminMenu`, action wrappers — fuera de scope B.5 inmediato.

**Cross-slice:** **ninguno**. Comments no exporta nada cross-slice excepto vía `discussions/public(.server)`.

### 5. Acoplamiento cross-sub-slice

- `comments/ui/comment-item.tsx`:1 → `@/features/discussions/comments/server/queries/comments` (own sub-slice). OK.
- `comments/ui/comment-item.tsx`:2 → `@/features/discussions/reactions/public` (cross-sub-slice via public). OK.
- `comments/ui/comment-item.tsx`:9 → `@/features/discussions/ui/edit-window-actions` (LEGACY UI raíz). **Bridge legacy** — `EditWindowActions` no migró aún, vive en raíz. Si B.5 borra raíz UI, hay que mover `edit-window-actions` también o promoverlo a un sub-slice/shared.

### 6. Mejora reportada por B.5

**LOC del raíz post-migración (estimación realista):**

- Borrar comments portion de `queries.ts`: -160 LOC.
- Borrar `server/actions/comments/`: -556 LOC.
- Borrar `ui/comment-*.tsx + quote-*.tsx + use-comment-realtime.ts`: -940 LOC (12 archivos).
- Borrar `load-more.ts` comments portion: -63 LOC.
- **Bajada bruta del raíz: ~1719 LOC** (de 6176 → ~4457).
- **Cap 1500 sigue violado por -2957 LOC.**

**Combined B.4 + B.5:** raíz iría a **~3402 LOC**, todavía 2× sobre el cap 1500. Sigue requiriendo excepción.

**Beneficios cualitativos:**

1. **CommentView shape unificado.** El sub-slice tiene `quoteState` en el view (JOIN integrado); el legacy lo computa fuera. Promover el sub-slice **elimina `resolveQuoteTargetStates` de `_comments-section.tsx`** (-15 LOC en `app/`).
2. **Cohesión completa de comments.** UI + queries + actions juntos.
3. **G.3 atomic permissions** unificado.

**Trade-offs / riesgos críticos:**

- **Riesgo #1 (CRÍTICO):** El sub-slice `comment-item.tsx` tiene la **regresión F.1 stub** ("Contenido temporalmente deshabilitado"). Si B.5 promueve el sub-slice tal cual, **el thread de comments deja de renderizar el body** en producción. Hay que portar el código `RichTextRenderer + MentionResolvers + quoteTargetState prop` del legacy al sub-slice ANTES de wirear.
- **Riesgo #2 (CRÍTICO):** El sub-slice `comment-thread-live.tsx` perdió la lazy-load del Supabase Realtime. Bundle First Load crece ~12-15 kB gzip por route. Hay que portar `comment-realtime-appender.tsx` + lazy + `requestIdleCallback` al sub-slice.
- **Riesgo #3 (alto):** El sub-slice `CommentView` tiene `quoteState` que el legacy no tiene. Si B.5 no actualiza el caller (`_comments-section.tsx`), el JOIN del sub-slice se ejecuta y agrega 1 RTT vs el approach legacy (computación fuera). Para no regresionar, hay que **eliminar `resolveQuoteTargetStates` y dejar de pasar el Map** en el caller.
- **Riesgo #4 (medio):** snapshot Audit #5 desaparece (ya cubierto en B.4 análogo).
- **Riesgo #5 (medio):** `revalidateCommentPaths` cambia firma (`kind` arg). Todos los call sites tienen que actualizarse o el comportamiento de revalidate cambia (sub-slice no revalida home + revalida menos en edit).
- **Riesgo #6 (alto):** `comment-item.tsx` legacy importa `EditWindowActions` desde `./edit-window-actions` (raíz). Sub-slice importa `@/features/discussions/ui/edit-window-actions` (raíz también). Mantener raíz wireado o sacar `edit-window-actions` a un slice/shared.

### 7. Complejidad y dependencias

- **Dependencia con B.4 (posts):** **bidireccional fuerte**. `loadMoreCommentsAction` está en `server/actions/load-more.ts` junto con `loadMorePostsAction`. Y `comments/server/actions/create.ts` usa `revalidateCommentPaths` que toca `/${placeSlug}/conversations` (path posts). Si B.4 va primero, simplifica el split de `load-more.ts`.
- **Dependencia con B.3 (threads):** mediana. `discussions/threads/ui/post-list.tsx` (orphan hoy) muestra commentCount derivado de `listPostsByPlace`. Sin acoplamiento directo a comments.
- **Transacciones:** `createCommentAction` toca Comment + Post (lastActivityAt update). Atomic. No interactúa con reactions/flags.
- **Tests E2E:** los smokes de `/conversations/<post>` cubren el thread render — si B.5 deja la regresión F.1 puesta, smoke explota visualmente al instante.

### 8. Estimación de esfuerzo

**Comparado con B.4:** B.5 es MÁS riesgoso por la regresión F.1 + lazy realtime + shape change. **5-7 horas efectivas**, splittable:

| Sub-fase     | Trabajo                                                                                                                      | Estimado   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Pre-flight   | Decidir reconciliación: F.3 RichText, lazy realtime, quoteState shape, kind revalidate, Audit #5                             | 45 min     |
| B.5.0        | Reconciliar sub-slice: portar F.3 RichText + lazy realtime + Audit #5 + comment-realtime-appender                            | 90-120 min |
| B.5.1        | Decidir sobre `quoteState` en CommentView: actualizar callers (`_comments-section.tsx` × 2) o backportear shape al sub-slice | 30 min     |
| B.5.2        | Re-wire `discussions/public.ts` UI components a `comments/public`                                                            | 30 min     |
| B.5.3        | Re-wire `discussions/public.server.ts` queries + `CommentView` a `comments/public.server`                                    | 30 min     |
| B.5.4        | Re-wire actions: `createCommentAction`, etc. a `comments/public`                                                             | 30 min     |
| B.5.5        | Borrar legacy: 12 archivos UI + actions + queries portion + load-more portion                                                | 30 min     |
| B.5.6        | Borrar tests legacy duplicados (4 archivos overlap)                                                                          | 15 min     |
| Smoke + docs | bundle ANALYZE crítico (lazy chunk) + smoke /conversations + /library                                                        | 30-45 min  |

**Commits razonables:** 6-7. **NO empaquetar B.5.0 con B.5.5** — la reconciliación tiene que ir aparte para diff legible.

---

## Comparación + recomendación

### Tabla resumen

| Aspecto                              | B.4 — Posts                                                                                                    | B.5 — Comments                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Sub-slice cableado externamente      | NO                                                                                                             | NO                                                                  |
| Sub-slice byte-equivalente al legacy | NO                                                                                                             | NO                                                                  |
| Sub-slice MÁS NUEVO que legacy       | Parcialmente (G.3 + ADR #2)                                                                                    | Parcialmente (G.3)                                                  |
| Sub-slice MÁS VIEJO que legacy       | Parcialmente (Audit #5, broadcast post_hidden, revalidate `/${placeSlug}`)                                     | Sí (F.3 RichText regression, lazy realtime regression, Audit #5)    |
| LOC sub-slice actual                 | 1004                                                                                                           | 1354                                                                |
| LOC eliminable del raíz              | ~1055                                                                                                          | ~1719                                                               |
| LOC raíz post-migración              | ~5121                                                                                                          | ~4457                                                               |
| Cierra excepción 1500?               | NO (-3621)                                                                                                     | NO (-2957)                                                          |
| Combined B.4 + B.5 raíz              | —                                                                                                              | ~3402 (-1902 al cap)                                                |
| Riesgos críticos                     | broadcast post_hidden, snapshot validation, revalidate /${placeSlug}                                           | F.3 RichText regression, lazy realtime perf, CommentView shape      |
| Esfuerzo estimado                    | 3.5-5 h                                                                                                        | 5-7 h                                                               |
| Smoke obligatorio                    | preview /conversations + admin hide                                                                            | preview /conversations + /library + thread reading + bundle ANALYZE |
| Bundle impact                        | bajo                                                                                                           | alto (lazy realtime)                                                |
| Cross-slice impact                   | events, library, flags (createPostFromSystem, hardDelete) — todos siguen igual via `discussions/public.server` | ninguno cross-slice                                                 |
| Bloqueador previo                    | B.3 (load-more.ts share) recomendado                                                                           | B.4 (load-more.ts share) preferible                                 |

### Recomendación

**Orden sugerido:** **B.3 → B.4 → B.5**, en sesiones separadas, con drift-window mínimo.

**Razones:**

1. **B.3 antes que B.4:** `discussions/threads/ui/load-more-posts.tsx` (orphan) consume `loadMorePostsAction` legacy. Si B.3 wirea el sub-slice threads, B.4 puede limpiar `loadMorePostsAction` legacy sin tocar B.3.
2. **B.4 antes que B.5:** ambos comparten `load-more.ts`. Migrar posts primero deja `load-more.ts` con sólo `loadMoreCommentsAction` — más simple de migrar a `comments/`.
3. **B.5 último:** es el más riesgoso (regresiones F.3 + lazy realtime + CommentView shape). Si B.4 sale verde, hay confianza para B.5. Si B.4 explota, no se mete B.5 antes de fixearlo.

**Cuándo NO abordarlas:**

- **Si el equipo planea Fase 7 (home dinámica) en próximas semanas:** la decisión sub-slice de eliminar `revalidatePath('/${placeSlug}')` se vuelve regresión activa. Coordinar con roadmap.
- **Si hay cambios pendientes en G.3 (atomic permissions):** ambas migraciones reconcilian feature G.3. Mejor cerrar G.3 estable antes.
- **Si rich-text está mid-flight a F.3 en otra rama:** el conflicto de merge en `comment-item.tsx` será doloroso.

**Cuándo SÍ abordarlas (gating):**

- B.4 es **abordable hoy** con bajo riesgo si:
  - Owner decide que `broadcastPostHidden` y `revalidatePath /${placeSlug}` se mantienen (port al sub-slice).
  - Owner decide sobre Audit #5 snapshot validation (port o aceptar pérdida).
- B.5 **no es abordable sin reconciliación previa** del sub-slice (port F.3 + port lazy realtime). Esto es un **mini-refactor del sub-slice**, no un re-wire.

**Alternativa táctica:** considerar **NO hacer B.5** y en su lugar:

- Borrar el sub-slice `discussions/comments/` entero como "experimento abandonado" (~1354 LOC fuera del repo).
- Documentar la decisión: el split de comments no aporta valor proporcional al riesgo de las regresiones.
- El raíz queda en 6176 — sigue violando cap 1500 con la excepción ya documentada.

Esta opción cuesta 30 min, **descarga la mente del owner** de mantener dos copias drifteando, y obliga a que el siguiente intento de split sea con un plan menos especulativo.

---

## Apéndice de gaps

Cosas que NO pude verificar en este análisis:

1. **Bundle size delta de la regresión lazy realtime en B.5.** No corrí `ANALYZE=true pnpm build`. El número "12-15 kB gzip" sale del comentario en `comment-thread-live.tsx` legacy; medir empíricamente antes de B.5.

2. **Por qué el sub-slice tiene G.3 y el legacy no.** Sospecho un orden temporal donde el sub-slice se creó (commits `d02da57` y `3770de5`) cuando el equipo intentaba consolidar, luego G.3 se aplicó al sub-slice (commits no inspeccionados). Pero el legacy nunca recibió G.3. **Esto necesita confirmación con `git log -p` de `posts/server/actions/delete.ts`** para entender si el sub-slice era el "current" en algún momento o si G.3 se aplicó por error sólo al sub-slice. Implicancia: si el legacy ejecuta hoy y carece de G.3, **el deploy actual está usando el path viejo de permissions** — no es regresión introducida por la migración, es una deuda actual silenciosa.

3. **Si los tests sub-slice corren verde hoy.** No corrí `pnpm vitest run`. La diff de mocks es enorme; algunos tests del sub-slice posiblemente fallan contra `prisma.groupMembership.findMany` que no existía cuando se escribieron, o pasan por casualidad por defaults.

4. **Tests E2E.** No inspeccioné `playwright.config.ts` ni `tests/e2e/`. Smoke manual en preview es la mitigación.

5. **Estado real de F.3 (Lexical RichTextRenderer).** Asumí del comentario "stub F.1: el RichTextRenderer (TipTap) se reemplaza en F.3" que F.3 ya está deployed (porque legacy lo usa). No verifiqué si está disponible en `@/features/rich-text/public.server` con `RichTextRenderer` exportable (sólo lo grep'eé indirecto).

6. **Acoplamiento de `EditWindowActions` (raíz) con sub-slice comments.** Confirmé que sub-slice importa `@/features/discussions/ui/edit-window-actions`. No verifiqué si ese archivo en sí mismo se piensa migrar (¿pertenece a comments? ¿a moderation? ¿a un nuevo sub-slice de "edit-window"?).

7. **Comportamiento de `discussions/server/queries/index.ts` orphan.** Existe un `index.ts` en `server/queries/` que re-exporta del sub-slice comments, pero `queries.ts` archivo gana en resolución. **No verifiqué qué pasa si se borra `queries.ts`** — si el resolver cambia a `queries/index.ts`, el path queda apuntando al sub-slice. Esto podría usarse como hack de "wireado parcial sin tocar `public.server.ts`" durante la migración.

8. **Si los WHITELIST del slice-size script consideran sub-slices o sólo el raíz.** El script reportó 6176 para raíz; inferí que ya excluye sub-slices. No verifiqué cómo cuenta el caso de "queries.ts archivo + queries/ directorio".

9. **Coordinación con B.3 (threads) en otro agent paralelo.** El plan padre menciona que otro agent planifica B.3. No vi el plan de B.3, así que las afirmaciones sobre coordinación B.3/B.4 son inferencias del estado del filesystem.
