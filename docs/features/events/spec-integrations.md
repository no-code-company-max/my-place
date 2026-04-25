# Events — Sub-spec Integraciones

> **Alcance:** integraciones del slice `events` con los slices vecinos. Auto-thread con discussions (tx atómica + helper `createPostFromSystemHelper`), gate hereda de hours, erasure 365d en members, EVENT en `ContentTargetKind` para flags, realtime explícitamente diferido. Complementa `spec.md`.

> **Referencias:** `spec.md § 3, § 7` (arquitectura + flow create), `docs/features/discussions/spec.md` (Post + slug + actions), `docs/features/hours/spec.md` (gate + helpers IANA), `docs/features/members/spec.md` (erasure 365d), `docs/decisions/2026-04-24-erasure-365d.md` (job runErasure), `CLAUDE.md § Gotchas` (Vercel Cron + quotedSnapshot inmutable).

## 1. Discussions — auto-thread en transacción atómica

### 1.1 Por qué tx atómica

Cuando un miembro publica un evento, queremos que las 3 operaciones siguientes pasen **o todas o ninguna**:

1. INSERT Event (sin postId).
2. INSERT Post (thread del evento) en el mismo place, con autor y snapshot.
3. UPDATE Event SET `postId = post.id` (vinculación bidireccional).

Si alguna falla a mitad de camino (RLS rechaza, slug collision tras retry, validation falla, RPC drop) podemos quedar con:

- Evento huérfano sin thread → la conversación nunca arranca.
- Thread sin evento → el Post existe en `/conversations` con título "Conversación: …" pero el botón "ver evento" rompe.
- Ambos creados pero `postId = null` → desincronización silenciosa.

Solución: una `prisma.$transaction(async (tx) => { … })` que abarque las 3 operaciones. Cualquier excepción rollbackea todo.

### 1.2 PR-1 — `createPostFromSystemHelper(tx, params)` en discussions

`createPostAction` (existente) usa el `prisma` singleton, no acepta `tx` client. Para que la creación del Post sea parte de la tx de Event, necesitamos un helper que reciba el tx client.

**No es una alternativa a TipTap**: TipTap genera el JSON `body` del lado cliente (igual que hoy). El helper sólo encapsula el INSERT del Post parametrizando el client transaccional.

**Firma**:

```ts
// src/features/discussions/server/actions/posts/create-from-system.ts
import 'server-only'

export async function createPostFromSystemHelper(
  tx: Prisma.TransactionClient,
  input: {
    placeId: string
    title: string // ej: "Conversación: <event.title>"
    body: Prisma.InputJsonValue // TipTap AST (helper local lo construye)
    authorUserId: string
    authorSnapshot: Prisma.InputJsonValue
    originSystem: 'event' // discriminador para logging
    eventId: string // metadata para audit
  },
): Promise<{ id: string; slug: string }>
```

**Comportamiento**:

- Resuelve slug único reusando `resolveUniqueSlug` (extraído de `create.ts` privado a `shared.ts` parametrizable por client).
- Construye `Post` con `lastActivityAt = now()`, `version = 0`, `authorSnapshot` congelado.
- INSERT bajo el `tx` client (no `prisma` singleton).
- **No** llama `assertPlaceOpenOrThrow` — la action de evento ya gateó antes de abrir la tx. Bypass intencional.
- **No** llama `revalidatePath` — la action de evento revalida sus rutas + las del thread al final de su flow.
- Logger: `pino.info({ event: 'postCreatedFromSystem', originSystem: 'event', eventId, postId, postSlug, placeId })`.
- Si `P2002` por slug collision tras 1 retry → `ConflictError` propaga al caller (la tx rollbackea).

**Tests** (`__tests__/posts/create-from-system.test.ts`):

1. Happy path: helper crea Post bajo tx, retorna `{id, slug}`.
2. Slug collision: primer attempt P2002 → segundo attempt OK con sufijo `-2`.
3. Falla RLS bajo tx → la tx caller rollbackea sin Post huérfano.

### 1.3 Flow `createEventAction` (F.E)

```ts
'use server'
export async function createEventAction(
  input: unknown,
): Promise<{ ok: true; eventId: string; postSlug: string }> {
  const parsed = createEventInputSchema.safeParse(input)
  if (!parsed.success)
    throw new ValidationError('Datos inválidos.', { issues: parsed.error.issues })

  const actor = await resolveActorForPlace({ placeId: parsed.data.placeId })
  await assertPlaceOpenOrThrow(actor.placeId)
  validateEventInvariants(parsed.data, new Date())

  const result = await prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        ...parsed.data,
        authorUserId: actor.actorId,
        authorSnapshot: buildAuthorSnapshot(actor.user),
      },
      select: { id: true, title: true },
    })

    const post = await createPostFromSystemHelper(tx, {
      placeId: actor.placeId,
      title: `Conversación: ${event.title}`,
      body: buildEventThreadIntroBody(event), // helper local: heading + descripción + callout linkeando
      authorUserId: actor.actorId,
      authorSnapshot: buildAuthorSnapshot(actor.user),
      originSystem: 'event',
      eventId: event.id,
    })

    await tx.event.update({
      where: { id: event.id },
      data: { postId: post.id },
    })

    return { eventId: event.id, postSlug: post.slug }
  })

  revalidatePath(`/[placeSlug]/events`, 'page')
  revalidatePath(`/[placeSlug]/events/${result.eventId}`, 'page')
  revalidatePath(`/[placeSlug]/conversations/${result.postSlug}`, 'page')
  return { ok: true, ...result }
}
```

### 1.4 Contrato del auto-thread

- **`Post.authorUserId` = `Event.authorUserId`** — quien publica el evento es quien abre la conversación. NO es un sistema-bot. Razón: el evento no tiene "voz independiente"; es el host quien invita y abre el espacio.
- **`Post.title` = `"Conversación: ${event.title}"`** — distingue visualmente threads-de-evento en `/conversations` vs Posts standalone. UI puede renderizar el prefix con tipografía propia o iconito.
- **`Post.body` = TipTap AST construido por `buildEventThreadIntroBody(event)`** — helper en `events/server/` que produce: heading "Conversación del evento [title]" + descripción del evento (si presente) + callout "[Ver evento → /events/<id>]". Permite que el thread arranque con contexto sin que el author tenga que copiar info.
- **Si Post falla** (RLS, slug collision tras retry, validation) → tx rollbackea Event también. Usuario recibe `ConflictError` o `ValidationError`. Nada queda persistido.
- **Si Event se edita post-publicación** (título, descripción): el Post **NO se actualiza automáticamente** en F1. Razón: el Post es contenido conversacional — los miembros pueden haber comentado pisando el contexto original. Cambiar el title del Post post-hoc rompe el hilo. La UI muestra el header del Post linkeando al evento (que sí refleja el estado actual). Documentado como decisión en ADR F.E.
- **Si Event se cancela (`cancelledAt`)**: el Post sigue vivo. UI del Post muestra badge "Evento cancelado" leyendo `event.cancelledAt` via la relación inversa `Post.event`.
- **`quotedSnapshot` en comments del thread del evento NO se afecta** por cancelación. Mismo principio que `quotedSnapshot.authorLabel` inmutable (ver `CLAUDE.md § Gotchas`): la cita es snapshot histórico del momento, no se retro-edita. Documentado como decisión explícita en ADR F.E para cerrarle el debate a futuras sesiones.

### 1.5 ADR F.E

`docs/decisions/2026-04-XX-events-discussions-cotransaction.md` registra:

- Decisión de tx atómica via `prisma.$transaction` con helper transaccional.
- Por qué `createPostFromSystemHelper` y no `createPostAction` directo.
- Por qué Post NO se auto-edita cuando Event cambia.
- `quotedSnapshot` inmutable bajo cancelación.
- Patrón aplicable a futuros pares de slices con co-creación atómica.

## 2. Hours — gate + edge case fuera de horario

### 2.1 Gate hereda automático

Las rutas `/[placeSlug]/(gated)/events/**` heredan el gate de `(gated)/layout.tsx`. Si el place está cerrado, los miembros ven `<PlaceClosedView>` en lugar del listado/detalle. Sin cambios al gate.

Defensa en profundidad: `createEventAction`, `updateEventAction`, `cancelEventAction`, `rsvpEventAction` llaman `assertPlaceOpenOrThrow(placeId)` al tope. Mismo patrón que discussions.

### 2.2 Edge case: evento programado fuera del horario del place

**Decisión de producto**: se permite (no bloqueamos), pero el form muestra warning.

Razón: hay use cases legítimos:

- Iglesia con horario "L-V 09-18" que organiza retiro de fin de semana fuera del horario del place — el evento sucede off-place pero la coordinación previa pasa por el thread.
- Empresa con horario laboral que organiza after-office a las 19:00 — el evento empieza fuera del horario regular pero es parte de la vida del place.
- La ontología `eventos.md § Sobre el horario del place y el evento` cubre estos casos explícitamente.

**Implementación F.D**:

```tsx
// EventForm calcula al cambiar startsAt:
const placeIsOpenAtStart = useServerAction(checkPlaceOpenAt, { placeId, startsAt })
{
  !placeIsOpenAtStart && (
    <Banner tone="warn">
      Tu evento empieza fuera del horario del place. Durante el cierre los miembros no podrán ver el
      thread asociado. ¿Querés ajustar el horario del place o publicar igual?
    </Banner>
  )
}
```

`checkPlaceOpenAt` es un server action thin que llama `isPlaceOpen(hours, startsAt)`.

Sin bloqueo — el author puede confirmar y publicar. Es información, no validación.

## 3. Members — erasure 365d (PR-3)

### 3.1 Qué pasa con los datos del ex-miembro

Cuando un miembro deja un place (`leftAt` set) y cumple 365 días, `runErasure` (cron diario) procesa su membership. El comportamiento se extiende para cubrir Events y EventRSVPs:

| Dato                                                | Tratamiento                      | Razón                                                                                                                                       |
| --------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Event.authorUserId`                                | NULL (mismo patrón Post/Comment) | Desliga al ex-miembro del contenido                                                                                                         |
| `Event.authorSnapshot.displayName`                  | "ex-miembro" (jsonb_set)         | Preserva el shape del snapshot pero anonimiza visualmente                                                                                   |
| `Event.title` / `description` / `location`          | Preservar tal cual               | Contenido público creado intencionalmente (igual que `Post.title`/`body`)                                                                   |
| `EventRSVP` del ex-miembro **en el place que dejó** | DELETE (deleteMany filtrado)     | RSVP es señal personal (mi presencia), no contenido público. Al cumplirse 365d garantizamos que no queda ninguna RSVP asociada a ese place. |
| `EventRSVP` del ex-miembro **en otros places**      | Preservar                        | Si el user sigue activo en otros places, sus RSVPs allá son parte de su vida activa. NO DELETE global.                                      |

### 3.2 Implementación PR-3 (en F.C, todo en mismo commit)

`src/features/members/server/erasure/run-erasure.ts`:

- Extender `ErasureSnapshotBeforeEntry` type a `'POST' | 'COMMENT' | 'EVENT'`.
- En `processOneMembership` (ya ejecuta dentro de `prisma.$transaction`):
  - Agregar `tx.event.findMany({ where: { authorUserId: m.userId, placeId: m.placeId } })`.
  - INSERT en `snapshotsBefore` con shape `{ type: 'EVENT', id, displayName, avatarUrl }`.
  - **Tercera sentencia raw SQL UPDATE** (hoy son 2: Post + Comment; queda 3):
    ```sql
    UPDATE "Event" SET
      "authorUserId" = NULL,
      "authorSnapshot" = jsonb_set("authorSnapshot", '{displayName}', '"ex-miembro"'::jsonb)
    WHERE "authorUserId" = ${m.userId} AND "placeId" = ${m.placeId}
    ```
  - Agregar `tx.eventRsvp.deleteMany({ where: { userId: m.userId, event: { placeId: m.placeId } } })` — **scope per-place** vía filtro nested. NO global.

`src/features/members/server/erasure/types.ts`:

- Extender `ErasureMembershipCounts` a `{ posts, comments, events, rsvpsDeleted }`.
- Extender `ErasureRunResult` agregando `eventsAnonymized: number` + `rsvpsDeleted: number`.

Consumers (sin cambios estructurales — TypeScript propaga shape extendido):

- `src/app/api/cron/erasure/route.ts` devuelve `result` JSON; el shape extendido pasa tal cual al caller HTTP. Update opcional al JSDoc si menciona campos del result.
- `scripts/jobs/erasure-365d.ts` `console.log(JSON.stringify(result, null, 2))` cubre los nuevos campos.
- `members/public.ts` re-export propaga.

Tests baseline (`src/features/members/server/erasure/__tests__/run-erasure.test.ts`):

- Asserts existentes (`result.postsAnonymized`, `result.commentsAnonymized`) **se actualizan en el MISMO commit** que extiende `types.ts` y `run-erasure.ts` para incluir `result.eventsAnonymized = N` + `result.rsvpsDeleted = N`. Sin esto, typecheck falla. NO crear test file nuevo — modificar existente.

3 casos nuevos en el mismo file:

- "Evento del ex-miembro queda anonimizado" → `authorUserId = NULL`, `authorSnapshot.displayName = 'ex-miembro'`.
- "RSVPs del ex-miembro borradas en el place que dejó" → count = 0 post-run.
- "RSVPs del ex-miembro **en otros places** se preservan" → fixture user con membership activa en otro place + RSVPs allá; verificar que persisten.

`scripts/jobs/smoke-erasure-365d.ts`:

- Agregar seed Event con prefix `evt_erasure_smoke_*` + EventRSVP del user.
- Verificación post-run: 3 escenarios anteriores.

### 3.3 Por qué no anonimizar `title` / `description` / `location`

Mismo criterio que Post/Comment: contenido público creado intencionalmente. Si Maxi (ex-miembro) propuso "Asado en mi casa el 20" con dirección, ese título y location son información del evento — del place — no del autor. Igual que un Post con título "El pub abre el viernes" no se renombra cuando el autor se va.

El `displayName` se renombra porque es la "voz" del autor. El contenido queda.

### 3.4 Por qué DELETE de RSVPs y no SetNull

RSVP es señal personal pura: "yo voy a este evento". No es contenido — no aporta valor histórico al place que el ex-miembro haya dicho "voy" hace 14 meses. Y un `userId NULL` en `EventRSVP` rompería el invariant del shape (la tabla espera `userId NOT NULL`). DELETE es la operación natural.

Razón adicional: la "capa 1" del derecho al olvido (al salir, no al cumplirse 365d) ya invisibiliza al ex-miembro via RLS — sus RSVPs no aparecen en `RsvpList` aunque persistan en DB. La capa 2 (365d) limpia el residuo físicamente. Patrón consistente con el principio "rastro personal se borra".

## 4. Flags — `EVENT` en `ContentTargetKind` (PR-2)

### 4.1 Por qué eventos son reportables

Un evento puede contener contenido inapropiado (título spammy, descripción ofensiva, location dudosa). Tratarlo como contenido del place — igual que Post/Comment — permite que cualquier miembro lo flaggee y que un admin lo revise en `/settings/flags`.

La ontología no lo dice explícito, pero el principio "moderación humana" se extiende naturalmente a eventos.

### 4.2 PR-2 — agregar `EVENT` al enum existente

`prisma/schema.prisma` enum `ContentTargetKind { POST, COMMENT, EVENT }`.

**Migration separada** (split de F.B en 2 archivos):

- `<TIMESTAMP_A>_events_core_schema/migration.sql` — CREATE TABLE Event + EventRSVP + RLS + indices.
- `<TIMESTAMP_B>_content_target_kind_add_event/migration.sql` — sólo `ALTER TYPE "ContentTargetKind" ADD VALUE 'EVENT'`.

Razón del split: Postgres restringe `ALTER TYPE ... ADD VALUE` a ejecutarse fuera de tx (límite del catalog system). Prisma migrate envuelve cada migration `.sql` en una sola tx implícita; correr `CREATE TABLE` + `ALTER TYPE` en el mismo `.sql` dispara `ERROR: ALTER TYPE ... ADD cannot run inside a transaction block`. Si esto se materializa en F.B se documenta como gotcha en `CLAUDE.md`.

### 4.3 Cambios en flags

`flags/schemas.ts`: Zod enum agrega `'EVENT'`.

`flags/server/queries.ts:collectFlagTargetIds`: convertir el if/else suelto actual a switch exhaustivo sobre `ContentTargetKind` con `assertNever` en el default. Patrón idiomático del codebase para evitar bugs silenciosos cuando aparezcan más targets.

`shared/lib/assert-never.ts` (NEW): helper compartido `export function assertNever(value: never): never { throw new Error(\`Unexpected value: \${JSON.stringify(value)}\`) }`. Genérico, sin dependencias de features. Se usa también en `events`(switches sobre`RSVPState`y`EventState`).

`flags/server/queries.ts:fetchFlagTargetsBatch`: agrega batch `prisma.event.findMany` paralelo a posts + comments dentro del `$transaction` existente.

`flags/server/queries.ts:listFlagTargetSnapshots`: consume el batch via `mapEventSnapshot`.

`flags/server/flag-view-mapper.ts:mapFlagToView`: agregar rama `if (snapshot.targetType === 'EVENT')` (hoy es `if POST / else COMMENT` implícito; pasarlo a switch exhaustivo en el mismo cambio para enforcement).

### 4.4 `mapEventSnapshot` — firma exacta

```ts
type EventFlagSnapshot = {
  targetType: 'EVENT'
  id: string
  title: string
  authorSnapshot: AuthorSnapshot // mismo type que Post/Comment
  startsAt: string // ISO 8601 UTC
  timezone: string // IANA del evento
  cancelledAt: string | null // ISO o null
}

function mapEventSnapshot(row: {
  id: string
  title: string
  authorSnapshot: Prisma.JsonValue
  startsAt: Date
  timezone: string
  cancelledAt: Date | null
}): EventFlagSnapshot
```

Razón de `cancelledAt` en el snapshot: el admin que revisa el flag necesita ver si el evento ya fue cancelado (afecta la decisión de moderación). Razón de `timezone`: para renderizar fecha en el contexto correcto del evento, no del admin que vive en otro huso.

### 4.5 Reacciones sobre Event

OUT OF SCOPE F1. El enum `ContentTargetKind` admite EVENT, pero `discussions/server/actions/reactions.ts:resolveReactableTarget` y `discussions/server/reactions-aggregation.ts` siguen filtrando POST + COMMENT. F.D no implementa UI de emojis sobre eventos.

Si producto pide reacciones sobre Event en post-F1, el cambio es chico: extender el switch con rama EVENT. Sin migración adicional.

## 5. Realtime — explícitamente diferido en F1

### 5.1 Qué se difiere

- **Presence** ("quién está mirando este evento ahora") en `/events/<id>` → diferido. Requiere UI de 3 momentos para tener sentido.
- **Broadcast de RSVP updates** ("Maxi acaba de confirmar") → diferido. F1 usa `revalidatePath` vanilla.
- **Broadcast de cancelación** ("este evento fue cancelado") → diferido. Si el author cancela mientras Tomás está mirando el detail, Tomás ve la cancelación al próximo refresh manual.
- **Broadcast de cambio de estado derivado** (transición upcoming → happening en el momento startsAt) → diferido. UI muestra el estado correcto en el próximo render server-side.

### 5.2 Por qué diferir

- La UI de "evento durante" es un design pass propio (ver ontología § Momento 2). Sin esa UI, presencia carece de contexto.
- RSVP optimistic update vanilla con `revalidatePath` da UX aceptable para el F1.
- Realtime infra existe (`shared/lib/realtime/`, ver C.J + ADR `2026-04-21-shared-realtime-module.md`). Cuando agreguemos presence en post-F1 reusamos directamente — sin rework.

### 5.3 Lo que F1 sí incluye

- `revalidatePath` en cada Server Action (`createEventAction`, `updateEventAction`, `cancelEventAction`, `rsvpEventAction`).
- Re-render del listado y detalle al hacer cualquier acción.
- Sin canal Supabase abierto desde events. Sin broadcast. Sin presence.

## 6. Resumen de archivos por slice tocados

### `events/` (nuevo, F.B → F.E)

- Schema, RLS, domain, queries, actions, UI, tests. Detalle en `spec.md § 3` y plan tidy-stargazing-summit.

### `discussions/` (PR-1, F.C)

- NEW: `server/actions/posts/create-from-system.ts`, test correspondiente.
- MOD: `server/actions/posts/shared.ts` extrae `resolveUniqueSlug` parametrizable.
- MOD: `public.server.ts` exporta `createPostFromSystemHelper`.
- MOD: `ui/post-detail.tsx` (F.E) renderiza header "Conversación del evento" + badge cancelado si `post.event` existe via relación inversa.

### `members/` (PR-3, F.C)

- MOD: `server/erasure/run-erasure.ts`, `server/erasure/types.ts`, test existente, smoke job.

### `flags/` (PR-2, F.C)

- MOD: `schemas.ts`, `server/queries.ts`, `server/flag-view-mapper.ts`, `__tests__/queries.test.ts`.

### `hours/` (sin cambios)

- Gate hereda automático. Helpers `isPlaceOpen` + `isAllowedTimezone` reusados sin tocar.

### `shared/` (PR-2, F.C)

- NEW: `lib/assert-never.ts` + test.

### `prisma/`

- MOD: `schema.prisma`.
- NEW: 2 migrations consecutivas en F.B.

### `src/app/[placeSlug]/(gated)/events/` (F.D)

- 4 páginas SC + components vía `events/ui/`.

### `tests/`

- NEW: `tests/rls/events.test.ts` (F.B), `tests/e2e/events-create-rsvp.spec.ts` (F.D).
- MOD: `tests/boundaries.test.ts` (F.C, validar nuevos imports public allowed).
