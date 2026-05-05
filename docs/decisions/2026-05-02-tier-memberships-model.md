# Modelo de datos del feature TierMemberships + Directorio

**Fecha:** 2026-05-02
**Estado:** Aceptada
**Origen:** M.0 del plan TierMemberships
(`docs/plans/2026-05-02-tier-memberships-and-directory.md`).

## Contexto

El producto ya tiene la primitiva `Tier` (ver
`docs/features/tiers/spec.md` y
`docs/decisions/2026-05-02-tier-model.md`). El siguiente paso es
**asignar tiers a miembros manualmente** desde un nuevo directorio
de miembros (owner-only). Sin Stripe — sólo asignación manual.

Adicionalmente, este feature **separa** dos cosas mezcladas hoy
en `/settings/members`:

- **`/settings/access`** (renombrado): invitar admin/member,
  transferir ownership, salir, gestionar invitaciones pendientes.
- **`/settings/members`** (nuevo): directorio del place con
  search + filtros + click → detalle del miembro.

El plan completo ejecutable está en
`docs/plans/2026-05-02-tier-memberships-and-directory.md`.
La spec del feature está en
`docs/features/tier-memberships/spec.md`. Este ADR registra las
decisiones de modelado que abrieron debate y se cerraron antes
de implementar.

## Decisiones

### 1. Tier sigue siendo monetización pura — NO grupos de moderación

**Pregunta original del user (2026-05-02)**: ¿conviene reusar
`Tier` como concepto unificado para ambos "segmentos de
monetización" Y "grupos de permisos editoriales" (estilo SMF /
foros antiguos: moderadores, contributors, etc.)?

**Decisión**: separar. `Tier` se mantiene como primitiva de
monetización exclusivamente. Los grupos de permisos editoriales
serán un slice nuevo (`groups/` o similar) cuando llegue.

**Razones**:

- **Semántica distinta**: Tier es `precio + duración + acceso a
contenido`. Grupo de moderadores es `responsabilidades
editoriales sin precio ni expiración`. Forzar ambos en `Tier`
  llena el modelo de campos opcionales que ofuscan el código.
- **Permisos granulares vienen con su propia complejidad**:
  matriz `(grupo, recurso, acción)` — moderar-en-X,
  ocultar-en-Y, aprobar-Z. Eso no es un campo del tier; es una
  estructura aparte.
- **Free tier como "Colaboradores" sigue teniendo sentido en
  Tier**: es un beneficio (acceso gratis al contenido pago,
  badge en el perfil). NO le da permisos de moderación. Cuando
  llegue el sistema de permisos, será una entidad nueva y el flow
  de asignar es el mismo patrón que estamos diseñando — reusable.

**Implicancia**: el directorio de miembros del place sirve como
**loci** unificado de gestión: el owner ve todos los miembros y
asigna tiers (acceso/beneficios). Cuando llegue grupos
editoriales, agregamos otra acción al detalle del miembro
("Asignar grupo") que dispara el flow del nuevo slice.

### 2. Cardinalidad N tiers por miembro

Un miembro puede tener N tiers asignados simultáneamente
(e.g., "Colaboradores" free + "Premium" pago). El UI inicial
puede priorizar mostrar uno "principal" (el más reciente o el
de mayor precio), pero el modelo permite N.

**Razones**:

- **Flexibilidad para casos legítimos**: colaborador con free
  tier de acceso + premium regalado por un mes.
- **Simpler que cardinality 1**: con cardinality 1, hay que
  resolver "qué tier mostrar si están dos asignados". Con N,
  ambos coexisten, la UI muestra una lista.
- `@@unique([tierId, userId])` previene duplicados del MISMO
  tier en el MISMO miembro. Ese sí es un caso degenerado.

**Decisión rechazada**: `@@unique([userId, placeId])` (un solo
tier por miembro). Bloquearía el caso de uso "free permanente +
premium temporal".

### 3. Expiración opcional con dos modos

Al asignar, el owner elige entre:

- **Indefinida** (`expiresAt = null`): vive hasta que el owner
  la remueva manualmente. Caso típico: free tier para
  colaboradores.
- **Automática** (`expiresAt = assignedAt +
tierDurationToDays(tier.duration)`): calcula al asignar usando
  el helper puro existente. Caso típico: regalar 30 días premium.

UI: checkbox "Indefinido" en el form de asignación. OFF por
default (usa la duración del tier).

**v1 sólo persiste el campo**. NO hay cron de expiración que
desactive la asignación al pasar `expiresAt`. La UI muestra
"Expira el X" como label informativo. Cuando llegue Stripe en
Fase 3:

- Cron diario revisa `expiresAt < NOW() AND expiresAt IS NOT NULL`.
- Para cada match, intenta renovar via Stripe. Si falla,
  desactiva la asignación (paywall toma over).
- Webhook `customer.subscription.deleted` → soft-delete o
  `expiresAt = now()`.

**Razones**:

- Owner manual flow no requiere enforcement v1 (es regalo).
- El campo `expiresAt` deja la base lista para Stripe sin
  ALTER TABLE retroactivo.

### 4. Sólo PUBLISHED se puede asignar

UI dropdown filtra los tiers disponibles a `visibility =
PUBLISHED`. Server action valida explícitamente — si llega un
`tierId` HIDDEN → `{ ok: false, error: 'tier_not_published' }`.

**Razones**:

- **Coherencia semántica**: HIDDEN significa "no listo / oculto".
  Asignar a miembros un tier oculto sería filtrar info que el
  owner explícitamente ocultó.
- **Simplicidad UX**: el owner que quiere asignar publica
  primero. Un solo flow claro.

**Decisión sobre asignaciones existentes a tier que pasa a
HIDDEN**: las asignaciones siguen vigentes (decisión #3 user
2026-05-02 confirmada). Razón: HIDDEN sólo afecta NUEVAS
asignaciones futuras + pricing pages futuros. Los miembros que
ya tienen el tier no pierden acceso. Coherente con "memoria
preservada" (CLAUDE.md).

### 5. Audit log con snapshot — sobrevive erasure 365d

`assignedByUserId` (nullable + `onDelete: SetNull`) +
`assignedBySnapshot Json` (`{ displayName, avatarUrl }`).

**Razones** (resuelto el 🔴 critical del audit del plan):

- El plan original asumía "el owner que asigna SIEMPRE existe" y
  hacía `assignedByUserId` NOT NULL. **Falso**: el owner puede
  dejar el place y pasar por erasure 365d. Su row de User puede
  sobrevivir pero su `displayName` se renombra a "ex-miembro" —
  audit info pierde semántica.
- Patrón canónico del proyecto: snapshot JSON congelado al
  momento del evento. Aplicado en `Post.authorSnapshot`,
  `Comment.authorSnapshot`, `Flag.reporterSnapshot`,
  `LibraryItem.authorSnapshot`, `Event.authorSnapshot`. Mismo
  trade-off documentado en
  `docs/decisions/2026-04-24-erasure-365d.md`.
- Cuando llegue Stripe en Fase 3, las asignaciones automáticas
  vendrán con `assignedByUserId = null` y
  `assignedBySnapshot = { displayName: 'Stripe', avatarUrl: null }`
  — el sistema soporta orígenes mixtos sin schema change.

**Decisión rechazada**: tabla separada `TierMembershipAuditLog`.
Over-engineering para v1. El snapshot inline es suficiente para
el caso "ver quién asignó este tier".

### 6. No exponer email del miembro en UI

El detalle del miembro muestra: nombre, handle, avatar,
joinedAt, role, isOwner, tiers asignados. **NO email**.

**Razones** (decisión #5 user 2026-05-02):

- **Privacidad**: el email es PII. El owner no necesita verlo
  para gestionar tiers/roles. Si necesita contactar al miembro,
  hay otros canales (handle, mensaje en el place).
- **Coherencia con `/m/[userId]`**: la page de perfil dentro
  del place tampoco lo muestra.
- **Implementación**: `findMemberDetailForOwner` NO selecciona
  email del User. Test verifica.

**Decisión rechazada**: mostrar email "sólo al owner". Romería
la regla "info contextual al place" (el email es identidad
universal, no contextual).

### 7. Búsqueda por nombre + handle

Server-side con `ILIKE` sobre `User.displayName` y `User.handle`.
Una sola query con `OR`. NO búsqueda por email (privacidad).

**Razones** (decisión #7 user 2026-05-02):

- **Search por nombre lo pidió el user explícitamente**.
- **Sumar handle es costo cero y mejora UX**: muchos miembros
  tienen handle más memorable que displayName.
- **Email NO** — coherente con decisión #6.

**Implicación**: M.1 agrega `@@index([displayName])` en User
para que ILIKE no haga full table scan.

### 8. Filtros: tier, rol, antigüedad

Combinables. Server-side con WHERE compuesto.

**Filtros v1**:

- **Por tier**: dropdown con tiers PUBLISHED del place. Opcional
  "Sin tiers asignados" como entry especial.
- **Por rol**: MEMBER / ADMIN.
- **Por antigüedad**: 7 días, 30 días, 90 días, 1 año, todos.
  Calculado contra `joinedAt`.

**Razones**:

- Los 3 filtros cubren el 90% de los casos de "encontrar a un
  miembro específico" en un place con 150 miembros.
- "Por antigüedad" útil para flows como "ver quién entró este
  mes" o "miembros viejos del place".

**Decisión rechazada**: filtro por "estado de pago", "método de
pago", "inactividad". Esos llegan con Fase 3 (Stripe + activity
tracking).

### 9. Slice nuevo `tier-memberships/`

Decisión #11 user 2026-05-02. Razones:

- **Clean separation** entre "qué se ofrece" (`tiers/`, primitiva
  ya implementada) y "quién está suscripto"
  (`tier-memberships/`, este feature).
- **Cuando llegue Stripe en Fase 3**, el slice gestiona también
  suscripciones automáticas + webhook handlers — no contamina
  `tiers/` con lógica de billing.
- **Imports unidirección**: `tier-memberships/` consume
  `tiers/public(.server)` y `members/public(.server)`. Nadie
  importa de `tier-memberships/` excepto pages de settings.

**Decisión rechazada**: extender `members/` con queries y
actions de tier assignment. Hubiera mezclado responsabilidades
("members" gestiona membership al place; agregar
"tier-membership" complica el slice).

### 10. Page detalle dedicada `/settings/members/[userId]`

Decisión #10 user 2026-05-02. Razones:

- **Linkeable**: el owner puede compartir el link al detalle de
  un miembro vía mensaje (futuro feature).
- **Futureproof**: cuando se sumen badges, audit log,
  historial de pagos (Fase 3), grupos editoriales, etc., todo
  vive en la misma page con secciones. Sin necesidad de modal
  cada vez más grande.
- **URL state**: el back button preserva los filtros del
  directorio.

**Decisión rechazada**: drawer/dialog desde el listado. Más
rápido de implementar pero menos extensible.

### 11. Rename `/settings/members` → `/settings/access`

Decisión #9A user 2026-05-02. El nuevo `/settings/members` es
el directorio. Razones:

- **Semántica más alineada**: el directorio ES la "lista de
  miembros". El path semánticamente sigue siendo "members" —
  sólo cambia qué affordances ofrece.
- **`/settings/access`** agrupa los workflows administrativos
  (invitar, pending, transfer, leave) — claro que es sobre
  "acceso al place".

**Trade-off**: bookmarks viejos a `/settings/members` ahora
aterrizan en el directorio. Para admin (que ya no tiene acceso),
recibe 404 — pierde UX. Aceptado porque:

- Es comunicable en release notes.
- Si la fricción aparece en feedback, se suma redirect 308 desde
  middleware en plan futuro.

**Decisión rechazada**: redirect 308 automático. Sumaría
complejidad al middleware sin valor inmediato. El path nuevo
es semánticamente correcto.

### 12. Lista read-only mini en `/settings/access`

Recomendación propia (no rechazada por user al revisar plan).
Render minimalista con avatares + nombres, sin search/filter ni
link al detalle.

**Razones**:

- **Admin necesita visibilidad básica de "quién está"** sin
  necesidad de pasar al directorio owner-only. Hoy ven la lista
  en `/settings/members`; con el rename, perderían ese
  affordance si no se compensa.
- **Costo bajo**: ~30 LOC reusando `listActiveMembers` (ya
  existe).
- **No duplica el directorio**: el directorio tiene search,
  filtros, click al detalle. La mini sólo muestra lista.

### 13. Promote/demote desde el directorio (owner-only)

Decisión #6 user 2026-05-02. UI: selector "Rol" con
confirmación al cambiar.

**Reglas**:

- Owner-only para v1. Más adelante, otros roles podrán recibir
  esta facultad cuando llegue el sistema de permisos editoriales
  (decisión #13 user 2026-05-02).
- **No permite degradar al owner**:
  `demoteToMemberAction` chequea via `findPlaceOwnership`. Si
  target es owner → `{ ok: false, error: 'cannot_demote_owner' }`
  con copy "Este usuario es owner. Transferí la ownership desde
  Acceso primero."
- **No permite promover al owner**: si target ya es owner, está
  más alto que admin. Action retorna
  `{ ok: false, error: 'cannot_promote_owner' }`.
- **Idempotente** sobre `already_admin` / `already_member` —
  retorna `{ ok: false, error: 'already_X' }` con copy "Este
  usuario ya tiene ese rol."

### 14. Discriminated union return para errores esperados

Aplicado a las 4 actions: `assignTierToMemberAction`,
`removeTierAssignmentAction`, `promoteToAdminAction`,
`demoteToMemberAction`.

**Razón**: gotcha CLAUDE.md (2026-05-02). Next 15 NO preserva
propiedades custom (`code`, `context`) ni `message` de un Error
tirado desde Server Action — el cliente recibe `digest` + 500
opaco. Para errores esperados del flujo, return discriminated
union es el patrón correcto.

Errores **inesperados** (auth fail, recurso no encontrado,
validación rota) siguen como throw — caen al `error.tsx`
boundary y muestran copy genérico.

### 15. `removeTierAssignmentAction` por `tierMembershipId` (no por par)

`removeTierAssignmentAction({ tierMembershipId })` — NO por
`(tierId, userId)`.

**Razón**: evitar race con asignación concurrente. Si dos
operaciones concurrentes:

1. Owner A remueve `(tierId=X, userId=Y)`.
2. Owner B asigna `(tierId=X, userId=Y)` justo después.

Si removeAction usara `(tierId, userId)`, podría borrar el row
recién creado por owner B. Con `tierMembershipId` explícito,
remueve sólo el row específico que el owner A vio en su UI.

## Implicancias

- **Migración**: `prisma/migrations/<ts>_tier_memberships_schema/`
  con el modelo + back-relations + índice `User.@@index([displayName])`.
  Sin RLS.
- **Slice**: `src/features/tier-memberships/` con domain
  (incluye `expiration.ts` y `snapshot.ts`), server, ui,
  schemas, public(.server). Estimado < 1500 LOC.
- **Members extension**: `searchMembers` + `findMemberDetailForOwner`
  - `promoteToAdminAction` + `demoteToMemberAction` +
    `MemberSearchParamsSchema`. Tests con Prisma spy verifican
    que las queries son 1 query con include (no N+1).
- **Settings nav**: 1 item nuevo (`'access'`) + 1 item modificado
  (`'members'` ahora con `requiredRole: 'owner'`). Tests
  actualizados.
- **Page rename**: `/settings/members/page.tsx` →
  `/settings/access/page.tsx`. Componentes asociados
  (`InviteMemberForm`, `PendingInvitationsList`,
  `TransferOwnershipForm`, `LeaveButton`) siguen exportados desde
  `members/public.ts` — sólo cambia el caller.
- **Pages nuevas**: 2 (`/settings/members` directorio +
  `/settings/members/[userId]` detalle).
- **Boundaries**: `tests/boundaries.test.ts` no cambia —
  `tier-memberships/` sólo importa de `tiers/public(.server)`,
  `members/public(.server)` y `shared/`.

## Cuándo revisar

- **Cuando arranque Stripe Connect (Fase 3)**: extender
  `assignTierToMemberAction` para soportar webhooks; sumar
  cron de expiración; sumar `Subscription` table o reusar
  `TierMembership` con flag.
- **Cuando llegue el plan unificado de RLS**: sumar policies
  basadas en `is_place_owner()`. Tests RLS dedicados.
- **Cuando llegue el sistema de permisos editoriales** (`groups/`):
  reusar el patrón de UI del directorio (search + filtros +
  detalle) para asignar grupos. La page detalle suma una sección
  "Grupos asignados" análoga a "Tiers asignados".
- **Si feedback indica que admin necesita el directorio
  completo**: re-evaluar bajar el gate a admin-or-owner. Por
  ahora owner-only protege la decisión comercial.

## No aplica

Este ADR **no** autoriza:

- Asignar tier a miembros desde flows que no sean el detalle
  (no hay bulk operations en v1).
- Cobrar a usuarios sin Fase 3 implementada.
- Mostrar email del miembro en UI (decisión #6 cerrada).
- Permisos editoriales (moderar/ocultar/eliminar) basados en
  Tier (decisión #1 cerrada).
- Pagar al owner por cobros de tier (eso requiere Stripe Connect
  - flujo completo de Fase 3).

## Referencias

- `docs/features/tier-memberships/spec.md` — spec completa.
- `docs/plans/2026-05-02-tier-memberships-and-directory.md` —
  plan ejecutable con sub-fases.
- `docs/decisions/2026-05-02-tier-model.md` — ADR de Tier
  (decisión #1 owner-only, decisión #11 partial unique).
- `docs/decisions/2026-04-24-erasure-365d.md` — patrón snapshot
  para audit que sobrevive erasure.
- `docs/decisions/2026-05-01-stripe-deferred-to-phase-3.md` —
  Stripe diferido.
- `docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md` —
  RLS unificado deferred.
- `CLAUDE.md` § Gotchas — discriminated union return,
  connection_limit, snapshot pattern.
