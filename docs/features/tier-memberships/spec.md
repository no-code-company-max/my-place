# TierMemberships + Directorio de miembros — Especificación

> **Alcance v1 (M.x, 2026-05-02)**: asignación manual de tiers a
> miembros del place + directorio owner-only para gestión. Sin
> Stripe — sólo asignación manual con expiración opcional. Stripe
> llega en Fase 3 y completa el flow de cobro.

> **Referencias:**
> `CLAUDE.md` (principios no negociables, gotcha discriminated
> union return, gotcha snapshot pattern para erasure 365d),
> `docs/architecture.md` (vertical slices),
> `docs/features/tiers/spec.md` (primitiva Tier — prerequisito),
> `docs/decisions/2026-05-02-tier-model.md` (ADR de Tier),
> `docs/decisions/2026-05-02-tier-memberships-model.md` (ADR de este feature),
> `docs/decisions/2026-04-24-erasure-365d.md` (snapshot pattern),
> `docs/decisions/2026-05-01-stripe-deferred-to-phase-3.md`
> (Stripe diferido),
> `docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md`
> (RLS unificado deferred),
> `docs/plans/2026-05-02-tier-memberships-and-directory.md`
> (plan ejecutable con sub-fases).

## 1. Modelo mental

Un **tier-membership** es una asignación de un tier a un miembro
específico del place. Materializa la relación "este miembro tiene
acceso a este tier por X tiempo" — el bloque sobre el que más
adelante Stripe enganchará el cobro automático.

En v1 esta primitiva sólo soporta **asignación manual**: el owner
elige un miembro, elige un tier publicado, opcionalmente define
expiración (o la deja indefinida) y la persiste. Sin paywall, sin
cobro, sin renovación automática. El campo `expiresAt` se
persiste pero no bloquea acceso — es informativo.

**Cuando llegue Stripe (Fase 3)**:

- Webhook `customer.subscription.created` → crea `TierMembership`
  automático con `assignedByUserId = null` y
  `assignedBySnapshot = { displayName: 'Stripe', avatarUrl: null }`.
- Webhook `customer.subscription.deleted` → soft-delete o
  `expiresAt = now()`.
- Cron de expiración revisa `expiresAt < NOW()` + intenta renovar
  via Stripe.

Adicionalmente, este feature **separa** dos cosas mezcladas hoy
en `/settings/members`:

- **`/settings/access`** (renombrado): invitar admin/member,
  transferir ownership, salir del place, gestionar invitaciones
  pendientes. Visible a admin-or-owner.
- **`/settings/members`** (nuevo): directorio del place con
  search + filtros + click → detalle del miembro. Owner-only.

**No es:**

- Un sistema de roles editoriales (moderar/ocultar/eliminar). Eso
  llega más tarde como un slice separado (`groups/` o similar)
  con su propia matriz de permisos. Ver decisión #1 ADR.
- Un buscador global. Sólo busca dentro de los miembros del place
  por `displayName` y `handle`.
- Un panel de billing. v1 NO muestra estado de pago, método de
  pago, ni montos cobrados. Eso llega con Fase 3.

**Es:**

- La asociación canónica miembro ↔ tier para alimentar futuras
  features (paywall, badges en `/m/[userId]`, beneficios por tier).
- Un canal manual del owner para "regalar" tiers (free tier para
  colaboradores, premium gratis para early adopters).
- Un directorio centralizado del place donde el owner gestiona
  asignaciones + cambia roles MEMBER ↔ ADMIN.

## 2. Vocabulario

- **TierMembership**: registro de la tabla — `{ id, tierId,
userId, placeId, assignedAt, assignedByUserId,
assignedBySnapshot, expiresAt, updatedAt }`.
- **Asignación indefinida**: `expiresAt = null`. Vive hasta que
  el owner la remueva manualmente. Caso típico: free tier para
  colaboradores.
- **Asignación con expiración**: `expiresAt = assignedAt +
tierDurationToDays(tier.duration)`. v1 sólo persiste el campo;
  no bloquea acceso. Caso típico: regalar 30 días premium.
- **Owner del place**: viewer con `PlaceOwnership` activa. Único
  rol que puede asignar/remover tiers y cambiar roles
  MEMBER↔ADMIN. Decisión coherente con CRUD de tiers (decisión
  #1 ADR `tier-model.md`).
- **Directorio**: page `/settings/members` con lista de todos los
  miembros del place + search + filtros. Owner-only.
- **Detalle del miembro**: page `/settings/members/[userId]` con
  info básica + tiers asignados + selector de rol. Owner-only.
- **Acceso (Access)**: page `/settings/access` con invitar +
  pending invitations + transferir ownership + salir + lista
  read-only mini. Admin-or-owner.
- **assignedBySnapshot**: JSON congelado al momento de asignar
  con `{ displayName, avatarUrl }` del assigner. Sobrevive aunque
  el assigner pase por erasure 365d (patrón canónico — ver
  `docs/decisions/2026-04-24-erasure-365d.md`).

**Idioma**: UI labels en español ("Asignar tier", "Quitar",
"Indefinido", "Expira el", "Promover a admin", "Degradar a
miembro", "Buscar", "Filtrar por…"). Código en inglés
(`TierMembership`, `assignTierToMemberAction`,
`searchMembers`, etc.).

## 3. Scope v1 — cerrado

**Sí en v1**:

- Modelo `TierMembership` (Prisma) + migration.
- Slice nuevo `src/features/tier-memberships/`.
- Server actions:
  - `assignTierToMemberAction`,
  - `removeTierAssignmentAction`.
- Queries:
  - `listAssignmentsByPlace(placeId)` — futuro audit/debug.
  - `listAssignmentsByMember(userId, placeId)` — alimenta detalle.
  - `findActiveAssignmentsForMember(userId, placeId)` — alias.
- Extensión members slice:
  - Query `searchMembers(placeId, params)` con filtros.
  - Query `findMemberDetailForOwner(userId, placeId)` — 1 query
    con `include`, NO retorna email.
  - Actions `promoteToAdminAction`, `demoteToMemberAction`.
  - Schema Zod `MemberSearchParamsSchema` para query params.
- Pages:
  - `/settings/access` (rename de `/settings/members` actual) +
    lista read-only mini para admin.
  - `/settings/members` (nuevo, owner-only): directorio.
  - `/settings/members/[userId]` (nuevo, owner-only): detalle.
- UI:
  - `<MemberSearchBar>`, `<MemberFilters>`, `<MembersList>`
    (directorio).
  - `<MemberDetailHeader>`, `<TierAssignmentControl>`,
    `<AssignedTiersList>`, `<RemoveAssignmentButton>`,
    `<RoleSelectorDialog>` (detalle).
- Audit log: `assignedByUserId` (nullable + SetNull) +
  `assignedBySnapshot` (JSON, congelado).
- Settings nav extension: `SETTINGS_SECTIONS` suma item
  `'access'` (admin-or-owner) inmediatamente antes del item
  `'members'`. El item `'members'` queda con
  `requiredRole: 'owner'`.
- Tests unit (queries + actions + invariantes + expiration
  helper) + E2E.

**NO en v1, deferred**:

- **Stripe Connect / cobro automático**. Diferido a Fase 3
  (`docs/decisions/2026-05-01-stripe-deferred-to-phase-3.md`).
- **RLS policies**. Diferido al plan unificado de RLS.
- **Sistema de permisos editoriales** (moderar/ocultar/eliminar).
  Slice nuevo cuando llegue.
- **Bulk operations** (asignar tier a N miembros simultáneo).
- **Job de expiración automática**. v1 sólo guarda `expiresAt`
  informativo. Cron + paywall con Stripe.
- **Filtros adicionales**: por estado de pago, por método de
  pago. Llegan con Fase 3.
- **Notificaciones a miembros** cuando se asigna/remueve un tier.
  Push notifications no existen en MVP.
- **Cambio de tier "in place"**. v1 obliga a remover y
  reasignar — explícito.
- **Invitar miembro CON tier pre-asignado** desde el flow de
  invite. v1 mantiene asignación post-accept como flow separado.
- **Audit log de remociones** (`removedAt`, `removedByUserId`).
  v1 hace hard-delete del row al remover. Si aparece la
  necesidad, se suma en plan futuro.
- **Promote/demote desde el flow de invite**. v1 sólo desde el
  detalle.

## 4. Routes y comportamiento

### `/settings/access` (admin-or-owner)

Server Component. Gate heredado del layout `/settings/layout.tsx`
(admin-or-owner). Renombre del actual `/settings/members/page.tsx`.

Estructura:

```tsx
const place = await loadPlaceBySlug(placeSlug)
if (!place) notFound()
// Gate ya aplicado en el layout — no lo re-chequeamos.

const [activeMembers, pendingInvitations, perms] = await Promise.all([
  listActiveMembers(place.id),
  listPendingInvitationsByPlace(place.id),
  findMemberPermissions(auth.id, place.id),
])

return (
  <div className="space-y-6 p-4 md:p-8">
    <SettingsHeader title="Acceso" />
    <InviteMemberForm placeId={place.id} canInviteAdmin={perms.isOwner} />
    <PendingInvitationsList invitations={pendingInvitations} />
    <ActiveMembersMini members={activeMembers} />  {/* read-only */}
    {perms.isOwner ? (
      <TransferOwnershipForm placeId={place.id} placeSlug={place.slug} />
    ) : null}
    <LeaveButton placeSlug={place.slug} isOnlyOwner={...} />
  </div>
)
```

`<ActiveMembersMini>` es nuevo — render minimalista con avatares

- nombres, sin search/filter ni link al detalle. Permite que
  admin conserve la visibilidad básica que tenía con la page
  anterior.

### `/settings/members` (owner-only — directorio)

Server Component. Doble gate: layout (admin-or-owner) + page
(`if (!perms.isOwner) notFound()`).

Estructura:

```tsx
const place = await loadPlaceBySlug(placeSlug)
if (!place) notFound()
const auth = await getCurrentAuthUser()
if (!auth) redirect(`/login?next=/settings/members`)

const perms = await findMemberPermissions(auth.id, place.id)
if (!perms.isOwner) notFound()

const params = MemberSearchParamsSchema.parse(await searchParams)
const [members, tiers] = await Promise.all([
  searchMembers(place.id, params),
  listTiersByPlace(place.id, true), // owner ve todos para filtrar
])

return (
  <div className="space-y-6 p-4 md:p-8">
    <SettingsHeader title="Miembros" />
    <MemberSearchBar initialQuery={params.query} />
    <MemberFilters
      initialRole={params.role}
      initialTierId={params.tierId}
      initialJoinedSince={params.joinedSince}
      tiers={tiers.filter((t) => t.visibility === 'PUBLISHED')}
    />
    <MembersList members={members} />
  </div>
)
```

URL state: `?q=ana&role=ADMIN&tierId=tier_xxx&joinedSince=30d`.
Client components actualizan los params via `useRouter().push()`

- `useSearchParams()`. El page RSC re-renderea con los nuevos
  filtros aplicados server-side.

### `/settings/members/[userId]` (owner-only — detalle)

Server Component. Mismo gate doble.

Estructura:

```tsx
const place = await loadPlaceBySlug(placeSlug)
if (!place) notFound()
const auth = await getCurrentAuthUser()
if (!auth) redirect(`/login?next=/settings/members/${userId}`)

const perms = await findMemberPermissions(auth.id, place.id)
if (!perms.isOwner) notFound()

const member = await findMemberDetailForOwner(userId, place.id)
if (!member) notFound()
const availableTiers = (await listTiersByPlace(place.id, true)).filter(
  (t) => t.visibility === 'PUBLISHED',
)

return (
  <div className="space-y-6 p-4 md:p-8">
    <BackButton href="/settings/members">Volver</BackButton>
    <MemberDetailHeader member={member} />
    <AssignedTiersList tierMemberships={member.tierMemberships} />
    <TierAssignmentControl
      placeSlug={place.slug}
      memberUserId={member.userId}
      availableTiers={availableTiers}
    />
    {!member.isOwner ? (
      <RoleSelectorDialog
        memberUserId={member.userId}
        placeId={place.id}
        currentRole={member.role}
      />
    ) : (
      <p className="text-sm text-muted">
        Este usuario es owner. Transferí la ownership desde Acceso antes de cambiar su rol.
      </p>
    )}
  </div>
)
```

## 5. Componentes UI

| Componente                 | Tipo   | Slice            | Props                                                            |
| -------------------------- | ------ | ---------------- | ---------------------------------------------------------------- |
| `<ActiveMembersMini>`      | Server | members          | `members: ActiveMember[]`                                        |
| `<MemberSearchBar>`        | Client | members (UI)     | `initialQuery?`                                                  |
| `<MemberFilters>`          | Client | members (UI)     | `initialRole?`, `initialTierId?`, `initialJoinedSince?`, `tiers` |
| `<MembersList>`            | Server | members (UI)     | `members: MemberSummary[]`                                       |
| `<MemberRow>`              | Server | members (UI)     | `member: MemberSummary` (link a detalle)                         |
| `<MemberDetailHeader>`     | Server | members (UI)     | `member: MemberDetail`                                           |
| `<RoleSelectorDialog>`     | Client | members (UI)     | `memberUserId`, `placeId`, `currentRole`                         |
| `<AssignedTiersList>`      | Server | tier-memberships | `tierMemberships: TierMembershipDetail[]`                        |
| `<RemoveAssignmentButton>` | Client | tier-memberships | `tierMembershipId`, `placeSlug`                                  |
| `<TierAssignmentControl>`  | Client | tier-memberships | `placeSlug`, `memberUserId`, `availableTiers`                    |

`<TierAssignmentControl>` (form Client):

- Dropdown con tiers PUBLISHED (filtrados server-side).
- Checkbox "Indefinido" (default OFF — usa `tier.duration`).
- Botón "Asignar" con `useTransition` + pending state.
- Toast Sonner por cada outcome (assigned / tier_already_assigned
  / tier_not_published / target_user_not_member).

`<RoleSelectorDialog>` (Client):

- Trigger: botón "Cambiar rol".
- Dialog con 2 radios: "Miembro" / "Admin".
- Confirmación: "Estás cambiando el rol de @handle. ¿Continuar?".
- Action call con `useTransition`. Toast con outcome.

## 6. Empty states

**Owner sin miembros (improbable, place vacío)**: el directorio
muestra empty state `🪶 "Este place todavía no tiene miembros.
Invitalos desde Acceso."` con link a `/settings/access`.

**Owner con miembros pero filtros aplicados sin matches**: empty
state `🔎 "Sin resultados. Probá con otro filtro o quitá los
filtros."` con CTA "Limpiar filtros".

**Owner detalle de miembro sin tiers asignados**: render del
`<AssignedTiersList>` con empty inline `"Este miembro no tiene
ningún tier asignado todavía."`.

## 7. Permisos (matriz canónica)

| Acción                                     | Owner  | Admin | Member común |
| ------------------------------------------ | ------ | ----- | ------------ |
| Ver `/settings/access`                     | ✓      | ✓     | —            |
| Invitar member                             | ✓      | ✓     | —            |
| Invitar admin                              | ✓      | —     | —            |
| Transferir ownership                       | ✓      | —     | —            |
| Reenviar invitación pendiente              | ✓      | ✓     | —            |
| Salir del place                            | ✓ \*   | ✓     | ✓            |
| Ver lista mini de miembros (en /access)    | ✓      | ✓     | —            |
| Ver `/settings/members` (directorio)       | ✓      | —     | —            |
| Ver item "Miembros" en `<SettingsNavFab>`  | ✓      | —     | —            |
| Buscar / filtrar miembros                  | ✓      | —     | —            |
| Ver `/settings/members/[userId]` (detalle) | ✓      | —     | —            |
| Asignar tier a miembro                     | ✓      | —     | —            |
| Remover asignación de tier                 | ✓      | —     | —            |
| Promover MEMBER → ADMIN                    | ✓      | —     | —            |
| Degradar ADMIN → MEMBER                    | ✓ \*\* | —     | —            |

\* Owner puede salir sólo si NO es el único owner (decisión
existente de places).

\*\* Owner NO puede degradar a otro owner — debe transferir
ownership primero. Action retorna
`{ ok: false, error: 'cannot_demote_owner' }`.

Defense in depth aplicado:

1. **UI gate**: pages `/settings/members*` hacen `if (!perms.isOwner)
notFound()`.
2. **UI filter**: `<SettingsNavFab>` filtra item `'members'` por
   `requiredRole: 'owner'`.
3. **Server action gate**: cada action llama
   `findPlaceOwnership(actorId, placeId)` antes de cualquier
   mutación. Si null → `AuthorizationError`.
4. **RLS** (deferida al plan unificado): cuarta capa cuando llegue.

## 8. Modelo de datos

```prisma
model TierMembership {
  id                 String   @id @default(cuid())
  tierId             String
  userId             String
  placeId            String
  assignedAt         DateTime @default(now())
  assignedByUserId   String?
  assignedBySnapshot Json
  expiresAt          DateTime?
  updatedAt          DateTime @updatedAt

  tier       Tier  @relation(fields: [tierId], references: [id], onDelete: Restrict)
  user       User  @relation("TierMembershipsAsUser", fields: [userId], references: [id], onDelete: Cascade)
  place      Place @relation(fields: [placeId], references: [id], onDelete: Cascade)
  assignedBy User? @relation("TierMembershipsAssigned", fields: [assignedByUserId], references: [id], onDelete: SetNull)

  @@unique([tierId, userId])
  @@index([placeId, userId])
  @@index([placeId, tierId])
  @@index([expiresAt])
}

// Cambio adicional al modelo User (M.1):
model User {
  // ... campos existentes
  @@index([displayName])  // Para searchMembers con ILIKE
}
```

**Decisiones clave** (full rationale en
`docs/decisions/2026-05-02-tier-memberships-model.md`):

- **Cardinalidad N**: un miembro puede tener N tiers
  simultáneos. `@@unique([tierId, userId])` previene duplicados
  del mismo tier.
- **Expiración opcional**: `expiresAt` nullable. NULL = indefinido.
  Si presente, calculado al asignar como `assignedAt +
tierDurationToDays(tier.duration)`. v1 informativo; cron en Fase 3.
- **Audit snapshot canónico**: `assignedByUserId` nullable +
  `onDelete: SetNull` + `assignedBySnapshot Json` con
  `{ displayName, avatarUrl }`. Patrón Post/Comment/Flag/Event
  (`docs/decisions/2026-04-24-erasure-365d.md`).
- **`onDelete: Restrict` sobre `tierId`**: previene borrar Tier
  con asignaciones vivas. v1 sólo soporta soft via HIDDEN — no
  hay riesgo. Cuando llegue hard-delete de tier, forzará al
  owner a remover asignaciones primero.
- **`onDelete: Cascade` sobre `userId` y `placeId`**: cleanup en
  hard-delete de user (futuro erasure) o de place. Coherente con
  el resto del schema.
- **`updatedAt @updatedAt`**: defensive. Stripe v3 lo usará para
  trackear renovaciones (extend expiration). Costo cero hoy.
- **`@@index([displayName])` en User**: M.1 lo agrega. Sin él,
  `searchMembers` con `ILIKE` hace full table scan.

## 9. Validación (Zod) — contrato de inputs

Schemas en `tier-memberships/schemas.ts`:

```ts
export const assignTierInputSchema = z.object({
  placeSlug: z.string().min(1).max(80),
  memberUserId: z.string().min(1),
  tierId: z.string().min(1),
  indefinite: z.boolean().default(false),
})

export const removeTierAssignmentInputSchema = z.object({
  tierMembershipId: z.string().min(1),
})
```

Schemas en `members/schemas.ts` (extensión M.3):

```ts
export const memberSearchParamsSchema = z.object({
  q: z.string().trim().max(60).optional(),
  role: z.enum(['MEMBER', 'ADMIN']).optional(),
  tierId: z.string().min(1).optional(),
  joinedSince: z.enum(['7d', '30d', '90d', '1y']).optional(),
})

export const promoteToAdminInputSchema = z.object({
  placeId: z.string().min(1),
  memberUserId: z.string().min(1),
})

export const demoteToMemberInputSchema = z.object({
  placeId: z.string().min(1),
  memberUserId: z.string().min(1),
})
```

## 10. Server actions

### `assignTierToMemberAction(input) → AssignTierResult`

```ts
type AssignTierResult =
  | { ok: true; tierMembershipId: string }
  | { ok: false; error: 'tier_not_published' | 'tier_already_assigned' | 'target_user_not_member' }
```

Owner-only. Flow:

1. Parse Zod del input.
2. Auth: `requireAuthUserId`.
3. Resuelve place por slug — `NotFoundError` si no existe o
   archivado.
4. Owner gate via `findPlaceOwnership` — `AuthorizationError` si
   no es owner.
5. Carga `tier` y `targetMember` (membership del target).
6. Validaciones:
   - Si `!targetMember || targetMember.leftAt !== null` →
     `{ ok: false, error: 'target_user_not_member' }`.
   - Si `tier.visibility !== 'PUBLISHED'` →
     `{ ok: false, error: 'tier_not_published' }`.
7. `expiresAt` calculado: si `input.indefinite` → null. Si no →
   `assignedAt + tierDurationToDays(tier.duration) * 24 * 60 * 60 * 1000`.
8. Carga `assignedByUser` (datos del owner) → snapshot
   `{ displayName, avatarUrl }`.
9. INSERT del `TierMembership`. Catch P2002 sobre
   `@@unique([tierId, userId])` →
   `{ ok: false, error: 'tier_already_assigned' }`.
10. Log + revalida `/{placeSlug}/settings/members/{userId}`.
11. Return `{ ok: true, tierMembershipId }`.

### `removeTierAssignmentAction({ tierMembershipId }) → RemoveTierAssignmentResult`

```ts
type RemoveTierAssignmentResult = { ok: true } | { ok: false; error: 'assignment_not_found' }
```

Owner-only. Identifica el row a remover por `tierMembershipId`
explícito (no por `(tierId, userId)` — evita race con asignación
concurrente).

Flow: parse → auth → carga `tierMembership` → resuelve place →
owner gate → `prisma.tierMembership.delete({ where: { id } })` →
log + revalida.

### `promoteToAdminAction(input) → PromoteResult`

```ts
type PromoteResult = { ok: true } | { ok: false; error: 'already_admin' | 'cannot_promote_owner' }
```

Owner-only. Flow estándar gate + chequea role actual:

- Si `member.role === 'ADMIN'` → `{ ok: false, error: 'already_admin' }`.
- Si owner del place → `{ ok: false, error: 'cannot_promote_owner' }` (semántica: ya tiene más privilegios que admin).
- Sino UPDATE `Membership.role = 'ADMIN'` + log + revalida.

### `demoteToMemberAction(input) → DemoteResult`

```ts
type DemoteResult = { ok: true } | { ok: false; error: 'already_member' | 'cannot_demote_owner' }
```

Owner-only. Flow:

- Si `member.role === 'MEMBER'` → `{ ok: false, error: 'already_member' }`.
- Si owner del place → `{ ok: false, error: 'cannot_demote_owner' }`. Owner debe transferir ownership desde `/settings/access` antes de degradar.
- Sino UPDATE `Membership.role = 'MEMBER'` + log + revalida.

## 11. Helper `computeExpiresAt`

```ts
// tier-memberships/domain/expiration.ts
export function computeExpiresAt(
  assignedAt: Date,
  tierDuration: TierDuration,
  indefinite: boolean,
): Date | null {
  if (indefinite) return null
  const days = tierDurationToDays(tierDuration)
  return new Date(assignedAt.getTime() + days * 24 * 60 * 60 * 1000)
}
```

Tests cubren los 7 casos: indefinite=true → null; cada uno de
los 6 valores de TierDuration → fecha calculada correcta.

## 12. Settings nav extension

`src/features/shell/domain/settings-sections.ts`:

```ts
export const SETTINGS_SECTIONS = [
  { slug: '', label: 'General' },
  { slug: 'hours', label: 'Horarios' },
  { slug: 'library', label: 'Biblioteca' },
  { slug: 'access', label: 'Acceso' }, // NEW (M.1.5)
  { slug: 'members', label: 'Miembros', requiredRole: 'owner' }, // CHANGED
  { slug: 'flags', label: 'Reportes' },
  { slug: 'tiers', label: 'Tiers', requiredRole: 'owner' },
] as const
```

Razón del orden: "Acceso" agrupa workflows operativos (invitar,
pending, transfer, leave) que admin hace constantemente.
"Miembros" es directorio owner-only de gestión avanzada.
Semánticamente: "Acceso" antes de "Miembros".

## 13. Principios no negociables aplicados (CLAUDE.md)

- **Sin métricas vanidosas**: el directorio NO muestra "miembro
  más activo", "tier más popular" ni rankings. Sí muestra
  contadores útiles ("X miembros encontrados", "Y tiers asignados")
  como info de stock.
- **Identidad contextual**: el directorio muestra nombre, handle,
  avatar, joinedAt, role, isOwner, tiers — todo info contextual
  al place. NO email (privacidad).
- **Sin urgencia artificial**: "Expira el X" sin countdowns, sin
  warnings de "queda 1 día!". Texto plano informativo.
- **Sin gamificación**: no hay "miembro fundador", "primero en
  recibir tier X" badges.
- **Customización activa**: el owner asigna manualmente — no hay
  "asignación automática por algoritmo".
- **Memoria preservada**: snapshot del assigner sobrevive
  erasure 365d. Audit log preserva intent histórico.

## 14. Sub-fases — referencia al plan

Ver `docs/plans/2026-05-02-tier-memberships-and-directory.md`
para el detalle ejecutable. Resumen:

| Sub       | Tema                                              | Quién               |
| --------- | ------------------------------------------------- | ------------------- |
| **M.0**   | Spec + ADR (este doc + ADR.md)                    | Lead                |
| **M.1**   | Schema + migration aplicada                       | Lead                |
| **M.1.5** | Pre-setup stubs compartidos para fan-out paralelo | Lead                |
| **M.2**   | Slice `tier-memberships/` completo                | Agente A (paralelo) |
| **M.3**   | Members extension (queries + actions + Zod)       | Agente B (paralelo) |
| **M.4**   | Rename `/settings/members` → `/settings/access`   | Lead                |
| **M.5**   | Page directorio                                   | Agente C (paralelo) |
| **M.6**   | Page detalle                                      | Agente D (paralelo) |
| **M.7**   | E2E + cleanup                                     | Lead                |

## 15. Verificación

### Por sub-fase

- typecheck + lint + tests targeted al slice modificado.

### Cuando M.7 cierre (final)

- typecheck + lint + suite completa (Vitest + E2E). RLS suite
  no aplica (deferida).
- Build prod limpio.
- Manual smoke en dev local: ver `docs/plans/2026-05-02-tier-memberships-and-directory.md`
  § Verificación para los 17 pasos del flow completo.
- E2E spec con 10+ escenarios.
