# Plan — TierMembership + Directorio de miembros (M.x)

## Context

El producto ya tiene la primitiva `Tier` (definición + visibilidad + CRUD
owner-only en `/settings/tiers`, ver
`docs/features/tiers/spec.md`). El siguiente paso es **asignar tiers a
miembros manualmente** desde un nuevo **directorio de miembros**
(owner-only). Sin Stripe — sólo asignación manual con expiración
opcional. Stripe llega en Fase 3 y completa el flow de cobro.

Adicionalmente, este plan **separa** dos cosas hoy mezcladas en
`/settings/members`:

- **`/settings/access`** (renombrado): invitar admin/member, transferir
  ownership, salir del place, gestionar invitaciones pendientes.
- **`/settings/members`** (nuevo, owner-only): directorio del place con
  search por nombre + filtros por tier/rol/antigüedad, click → detalle
  del miembro con asignación de tier + promoción/degradación de role.

**Por qué owner-only el directorio**: la asignación de tier (y futuro
de permisos) es decisión comercial / estructural del owner (decisión
#1 ADR de tiers). Admin sigue viendo la lista read-only mini en
`/settings/access` para visibilidad básica de "quién está".

**Decisión cerrada (2026-05-02)**: tiers se mantienen como **primitiva
de monetización exclusivamente** — NO se mezclan con grupos de
permisos editoriales (moderar/ocultar/eliminar). Cuando llegue ese
sistema será un slice nuevo (`groups/` o similar) con su propia
matriz de permisos. Free tier ($0) sigue válido para casos
"colaboradores con acceso gratis al contenido pago" — beneficio, no
permiso.

## Scope v1 (cerrado)

**Entra**:

- Modelo `TierMembership` (Prisma) + migration + back-relation desde
  `Tier`, `User`, `Place`.
- Slice nuevo `src/features/tier-memberships/` (vertical slice
  autocontenido — decisión #11 audit del plan inicial).
- Server actions:
  - `assignTierToMemberAction(input) → AssignTierResult`
    donde `AssignTierResult = { ok: true; tierMembershipId } | { ok: false; error: 'tier_not_published' | 'tier_already_assigned' | 'target_user_not_member' }`.
  - `removeTierAssignmentAction({ tierMembershipId }) → { ok: true } | { ok: false; error: 'assignment_not_found' }`. Identifica el row a remover por `tierMembershipId` explícito (no por `(tierId, userId)` — evita race con asignación concurrente).
  - Owner-only.
- Queries:
  - `listAssignmentsByPlace(placeId)` — para audit/debug futuro, no se usa en v1.
  - `listAssignmentsByMember(userId, placeId) → TierMembershipDetail[]` — incluye `tier` joined (1 query con `include`, no N+1).
  - `findActiveAssignmentsForMember(userId, placeId)` — alias semántico (v1 no distingue "activo" vs "expirado"; cuando llegue Stripe, filtra por `expiresAt > NOW() OR expiresAt IS NULL`).
- Extensión members slice:
  - Query `searchMembers(placeId, params: MemberSearchParams) → MemberSummary[]`. Una sola query Prisma con `WHERE` compuesto + index hits sobre `(placeId, role)` y `User.displayName`. NO N+1: incluye `_count` de TierMemberships si la UI necesita un contador de tiers.
  - Query `findMemberDetailForOwner(userId, placeId) → MemberDetail | null`. **1 query** con `include` explícito: `{ user: { select: { displayName, handle, avatarUrl } }, tierMemberships: { include: { tier: true }, where: { /* activo */ } } }`. Excluye `email` del select (decisión #6 privacidad). Test verifica con Prisma spy/mock que es 1 query, no N.
  - Schema Zod `MemberSearchParamsSchema` para validar query params del directorio (q?, role?, tierId?, joinedSince?). CLAUDE.md exige Zod sobre todo input externo — query params lo son.
  - Actions `promoteToAdminAction(input) → { ok: true } | { ok: false; error: 'already_admin' | 'cannot_promote_owner' }`. Owner-only. Idempotente sobre `already_admin`.
  - Actions `demoteToMemberAction(input) → { ok: true } | { ok: false; error: 'already_member' | 'cannot_demote_owner' }`. Owner-only. NO toca PlaceOwnership; chequea via `findPlaceOwnership` y bloquea si target es owner.
- Page `/settings/access` (rename de `/settings/members` actual):
  invitar, pending, transfer ownership, leave + lista read-only mini.
- Page `/settings/members` (nuevo, owner-only): directorio con
  `<MemberSearchBar>` + `<MemberFilters>` + `<MembersList>`.
- Page `/settings/members/[userId]` (nuevo, owner-only): detalle del
  miembro con info básica (nombre, handle, avatar, joinedAt, role,
  isOwner) + asignar/quitar tier + cambiar rol.
- Audit log: `TierMembership.assignedByUserId` + `assignedAt`.
- Settings nav: extender `SETTINGS_SECTIONS` con item `'access'` (sin
  requiredRole — admin-or-owner) y mantener `'members'` con
  `requiredRole: 'owner'`.
- Spec `docs/features/tier-memberships/spec.md` + ADR
  `docs/decisions/2026-05-02-tier-memberships-model.md`.
- Tests unit (queries + actions + invariantes) + E2E (directorio +
  detalle + assign/remove + promote/demote + gates).

**Fuera de v1 (explícito)**:

- **Stripe Connect / cobro automático**. Diferido a Fase 3
  (`docs/decisions/2026-05-01-stripe-deferred-to-phase-3.md`).
  La expiración con `expiresAt` deja un campo listo; el job de
  renovación + paywall se suma con Stripe.
- **RLS policies**. Diferido al plan unificado de RLS
  (`docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md`).
  Owner-only enforce a nivel app (server actions + UI gate).
- **Sistema de permisos editoriales** (moderar/ocultar/eliminar
  posts/comments). Cuando llegue será slice separado — Tier NO se
  usa para esto.
- **Bulk operations** (asignar tier a N miembros a la vez).
- **Job de expiración automática** que limpia `expiresAt < NOW()`.
  v1 sólo guarda `expiresAt` informativo; no hay cron que
  desactive la asignación. Stripe webhook `customer.subscription.deleted`
  lo manejará en Fase 3.
- **Filtros adicionales**: por estado de pago, por método de
  pago, por inactividad. Llegan con Fase 3.
- **Notificaciones a miembros** cuando se asigna/remueve un tier.
  Push notifications no existen en MVP (CLAUDE.md "Sin push agresivas").
- **Cambio de tier "in place"** (de Basic → Premium sin remover
  primero). v1 obliga a remover y reasignar — explícito.
- **Invitar miembro CON tier pre-asignado** desde el flow de
  invite. v1 mantiene asignación post-accept como flow separado.

## Decisiones de modelo

1. **Cardinalidad N tiers por miembro**. Un miembro puede tener
   varios tiers asignados simultáneamente (e.g., "Colaboradores"
   free + "Premium" pago). UI inicial puede priorizar mostrar uno
   "principal" pero el modelo permite N. `@@unique([tierId, userId])`
   previene duplicados del mismo tier.

2. **Expiración**: dos modos según checkbox del owner al asignar:
   - **Indefinida** (`expiresAt = null`): vive hasta que el owner la
     remueva manualmente. Caso típico: free tier para colaboradores.
   - **Automática** (`expiresAt = assignedAt + tier.duration`):
     calcula al asignar usando `tierDurationToDays(tier.duration)`.
     Caso típico: regalar 30 días premium. v1 sólo persiste el
     campo; el cron de expiración + paywall llegan con Stripe.

3. **Sólo PUBLISHED se puede asignar**. UI filtra los tiers
   disponibles a `visibility = 'PUBLISHED'`. Server action valida.
   Si el owner quiere asignar un tier nuevo, debe publicarlo
   primero. Asignaciones a tiers que luego pasen a HIDDEN siguen
   vigentes (decisión #3 confirmada por user 2026-05-02).

4. **Solo owner asigna/remueve tier y cambia roles**. Admin no
   califica — coherente con tier CRUD owner-only (decisión #1 del
   ADR de tiers). Defense in depth: server actions con
   `findPlaceOwnership` + UI gate `perms.isOwner`. RLS suma cuarta
   capa cuando llegue. Más adelante, otros roles podrán recibir
   esta facultad (decisión #13 user 2026-05-02), pero requiere el
   sistema de permisos editoriales (fuera de scope v1).

5. **Audit log mínimo siempre**: `assignedByUserId` (quién asignó)
   - `assignedAt` (cuándo). Útil para futuro debugging y para
     diferenciar manual vs Stripe-paid en Fase 3. Sin `removedAt` o
     `removedByUserId` en v1 (hard-delete del row al remover —
     simple). Si aparece necesidad de audit de remociones, se suma
     en plan futuro.

6. **No exponer email del miembro en UI**. Owner ve nombre, handle,
   avatar, joinedAt, role, isOwner, tiers. Email queda como dato
   privado del usuario (decisión #5 user 2026-05-02). Implica:
   - Query `findMemberDetailForOwner(userId, placeId)` NO retorna
     email.
   - El detalle del miembro tampoco lo muestra.

7. **Búsqueda por nombre solamente** (decisión #7 user 2026-05-02).
   Server-side con `ILIKE` en `User.displayName`. Suma búsqueda por
   `handle` también — no costo extra y mejora UX. NO búsqueda por
   email (decisión #6 privacidad).

8. **Filtros**: por tier, por rol (MEMBER/ADMIN), por antigüedad
   (joinedSince: 7 días, 30 días, 90 días, 1 año, todos). Combinables.

9. **Slice nuevo `tier-memberships/`** (decisión #11 user 2026-05-02).
   Razones:
   - Clean separation entre "qué se ofrece" (tiers) y "quién está
     suscripto" (tier-memberships).
   - Cuando llegue Stripe en Fase 3, el slice gestiona también
     suscripciones automáticas + webhook handlers — no contamina
     `tiers/`.
   - Imports: `tier-memberships/` consume `tiers/public(.server)`
     y `members/public(.server)`.

10. **Page detalle dedicada** `/settings/members/[userId]` (decisión
    #10 user 2026-05-02). Más linkeable, futureproof si sumamos más
    secciones (badges, historial, audit log, etc.).

11. **Rename `/settings/members` → `/settings/access`** (decisión #9A
    user 2026-05-02). El nuevo `/settings/members` es el directorio.
    Sin redirect — el bookmark viejo aterriza en el directorio
    (UX-distinto pero alineado con el nombre).

12. **Lista read-only mini en `/settings/access`** (recomendación
    propia, no contradice user): admins necesitan visibilidad básica
    de "quién está" sin pasar al directorio owner-only. Render
    minimalista (avatares + nombres, sin search/filter ni link al
    detalle). Opt-in del user al revisar el plan.

13. **Promoción/degradación admin desde el directorio** (decisión #6
    user 2026-05-02). UI: selector "Rol" con confirmación al cambiar.
    Owner-only. Action `promoteToAdminAction({ userId, placeId })` /
    `demoteToMemberAction({ userId, placeId })` en `members/`.
    NO permite degradar al owner (gate en action).

## Schema (M.1)

```prisma
model TierMembership {
  id               String    @id @default(cuid())
  tierId           String
  userId           String
  placeId          String
  assignedAt       DateTime  @default(now())
  // FK al user que asignó. Nullable + onDelete: SetNull para que
  // el row sobreviva si el assigner pasa por erasure 365d (su row
  // de User puede mantenerse pero su displayName se renombra a
  // "ex-miembro"). El snapshot abajo preserva el dato histórico.
  assignedByUserId String?
  // Snapshot del assigner — patrón Post/Comment/Flag/Event de
  // erasure 365d. Congela `{ displayName, avatarUrl }` al momento
  // de asignar. Si el assigner pasa por erasure, su displayName
  // se renombra a "ex-miembro" en User, pero este snapshot queda
  // intacto (mismo trade-off documentado en
  // docs/decisions/2026-04-24-erasure-365d.md § "Snapshots").
  // Tipo JSON: { displayName: string, avatarUrl: string | null }.
  assignedBySnapshot Json
  // NULL = indefinido. Si presente, viene calculado de
  // `assignedAt + tierDurationToDays(tier.duration)` al asignar.
  // v1 sólo lo guarda informativo; cron de expiración + paywall
  // llegan en Fase 3 con Stripe.
  expiresAt        DateTime?
  // Defensive future-proofing: cuando llegue Stripe v3 podrá
  // trackear renovaciones (extend expiration). Costo cero ahora.
  updatedAt        DateTime  @updatedAt

  tier       Tier  @relation(fields: [tierId], references: [id], onDelete: Restrict)
  user       User  @relation("TierMembershipsAsUser", fields: [userId], references: [id], onDelete: Cascade)
  place      Place @relation(fields: [placeId], references: [id], onDelete: Cascade)
  assignedBy User? @relation("TierMembershipsAssigned", fields: [assignedByUserId], references: [id], onDelete: SetNull)

  @@unique([tierId, userId])  // máx 1 instancia del mismo tier por miembro
  @@index([placeId, userId])  // listado por miembro en el directorio
  @@index([placeId, tierId])  // futuro: ranking de tier más asignado
  @@index([expiresAt])        // futuro: cron de expiración (Fase 3)
}
```

**Cambio adicional al schema**: agregar índice en `User.displayName`
para soportar `searchMembers` con `ILIKE`. Sin este índice la query
hace full table scan; con 150 miembros × N places escala mal.

```prisma
model User {
  // ... campos existentes
  @@index([displayName])  // M.1: índice para searchMembers ILIKE
}
```

**Notas**:

- `onDelete: Restrict` sobre `tierId`: previene borrar un Tier con
  asignaciones vivas. Forzará en futuro (cuando exista hard-delete
  de tier) que el owner remueva las asignaciones primero. Hoy
  v1 sólo soporta soft via `visibility=HIDDEN`, no hay riesgo.
- `onDelete: Cascade` sobre `userId` y `placeId`: si el user se
  hard-deletea (futuro erasure) o el place se borra, las
  asignaciones se cleanup. Coherente con el resto del schema.
- `assignedByUserId` nullable + `onDelete: SetNull` + snapshot
  paralelo (`assignedBySnapshot`): patrón canónico de erasure 365d
  del proyecto. El snapshot congela el displayName al momento de
  asignar — sobrevive aunque el assigner pase por erasure.
  El UI consume el snapshot, no el join al User. Cross-reference:
  `docs/decisions/2026-04-24-erasure-365d.md`.
- `@@unique([tierId, userId])`: invariante de "no duplicados del
  mismo tier en el mismo miembro". Permite cardinality N porque
  el unique es por par (tier, user) — no por user solo.
- `updatedAt @updatedAt`: defensive future-proofing para Stripe.
  Costo cero hoy, evita ALTER TABLE retroactivo en Fase 3.
- Sin partial unique adicional: la regla "máx 1 PUBLISHED por
  (placeId, name)" del slice `tiers/` ya está. No hay regla
  análoga para `TierMembership`.

## Arquitectura del slice `tier-memberships/`

```
src/features/tier-memberships/
├── domain/
│   ├── types.ts            // TierMembership, TierMembershipDetail, AssignedBySnapshot
│   ├── invariants.ts       // assertTargetIsActiveMember, assertTierPublished
│   ├── expiration.ts       // computeExpiresAt(assignedAt, duration, indefinite): Date | null
│   └── snapshot.ts         // buildAssignedBySnapshot(user) — patrón canónico erasure 365d
├── server/
│   ├── queries.ts          // listAssignmentsByPlace, listAssignmentsByMember, findActiveAssignmentsForMember
│   └── actions/
│       ├── assign-tier.ts
│       └── remove-tier-assignment.ts
├── ui/
│   ├── tier-assignment-control.tsx   // client (form: tier dropdown PUBLISHED + checkbox indefinido + submit + useTransition)
│   ├── assigned-tiers-list.tsx       // server (lista de TierMemberships con botón remover Client island)
│   ├── remove-assignment-button.tsx  // client (action call con confirmación)
│   └── errors.ts                      // friendlyTierMembershipErrorMessage
├── __tests__/
│   ├── invariants.test.ts
│   ├── expiration.test.ts
│   ├── queries.test.ts               // mock prisma
│   ├── assign-tier.test.ts           // mock prisma + auth + identity-cache
│   └── remove-tier-assignment.test.ts
├── public.ts               // tipos + UI client-safe + Server Actions
├── public.server.ts        // import 'server-only' + queries
└── schemas.ts              // Zod (assign/remove input)
```

## Sub-fases

| Sub       | Tema                                                                                                                                                                                                 | Sesiones | Deliverable                                                                                                                     | Quién                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **M.0**   | Spec + ADR (este doc + spec.md + ADR.md)                                                                                                                                                             | 1        | `docs/features/tier-memberships/spec.md` + `docs/decisions/2026-05-02-tier-memberships-model.md`                                | Lead                        |
| **M.1**   | Schema + migration + Prisma generate + verificar typecheck. Incluye `User.@@index([displayName])`.                                                                                                   | 0.5      | Migration `tier_memberships_schema` aplicada al cloud dev. `Tier`, `User`, `Place` con back-relations.                          | Lead                        |
| **M.1.5** | **Pre-setup**: stubs compartidos para fan-out paralelo (`members/public*.ts`, `members/server/queries.ts` skeletons, `shell/domain/settings-sections.ts` con item `'access'`).                       | 0.25     | Repo en estado typecheck verde con stubs sin implementar. M.2 y M.3 pueden arrancar en paralelo sin tocar archivos compartidos. | Lead                        |
| **M.2**   | Slice `tier-memberships/` skeleton + domain + queries + actions + tests dominio + tests actions.                                                                                                     | 1.5      | `tier-memberships/` completo (~13 archivos). 2 actions con discriminated union return + audit snapshot + tests.                 | Agente A (paralelo con M.3) |
| **M.3**   | Members slice: implementar queries `searchMembers` + `findMemberDetailForOwner` (1 query con include) + actions `promote/demote` + Zod `MemberSearchParamsSchema` + tests. Llena los stubs de M.1.5. | 1        | `members/server/queries.ts` extendido. 2 nuevas actions. `members/public(.server).ts` exports completos.                        | Agente B (paralelo con M.2) |
| **M.4**   | Rename `/settings/members` → `/settings/access` + lista read-only mini para admin + ajustar tests del nav.                                                                                           | 0.5      | Page renombrada con todos los componentes preservados. Tests del nav verdes.                                                    | Lead                        |
| **M.5**   | Nueva page `/settings/members` (directorio): `<MemberSearchBar>`, `<MemberFilters>`, `<MembersList>` + URL state + tests RTL.                                                                        | 1.5      | Page directorio owner-only. Search + 3 filtros (tier/rol/antigüedad) operativos.                                                | Agente C (paralelo con M.6) |
| **M.6**   | Page `/settings/members/[userId]` (detalle) + `<TierAssignmentControl>` + `<RoleSelectorDialog>` + tests RTL.                                                                                        | 2        | Page detalle owner-only. Asignar/quitar tier + promote/demote con confirm dialog.                                               | Agente D (paralelo con M.5) |
| **M.7**   | E2E spec + fixtures + manual smoke + cleanup + actualizar docs.                                                                                                                                      | 1        | `tests/e2e/flows/members-directory.spec.ts` con 10+ escenarios. Suite completa verde + build prod.                              | Lead                        |
| **Total** |                                                                                                                                                                                                      | **9.25** |                                                                                                                                 |                             |

### Paralelización con agentes — workflow detallado

Patrón establecido por user (gotcha CLAUDE.md): "generar primero
lo que se consume por los otros agentes y luego lanzar el trabajo
agentico en paralelo cuando ya no tienen que tocar o crear
archivos o codigo compartido, solo consumirlo."

**Audit de dependencias (post-revisión 2026-05-02)** detectó que
el plan original ("M.2 + M.3 paralelos directos") es inseguro:
M.3 modifica `members/public.ts` y `public.server.ts` que M.5 y
M.6 importan. Si M.3 no cierra antes de spawnear M.5/M.6, el
build rompe. Solución: **pre-setup del lead** que crea stubs
compartidos antes del fan-out.

**Workflow definitivo**:

1. **Lead — M.0 (secuencial)**: spec + ADR.
2. **Lead — M.1 (secuencial)**: schema + migration aplicada al
   cloud dev + `pnpm prisma generate`. Termina con typecheck verde.
3. **Lead — Pre-setup M.2/M.3 (~0.25 sesión)**: crea stubs
   compartidos para que M.2 y M.3 puedan paralelizar sin tocarse:
   - `src/features/members/server/queries.ts`: agrega skeletons de
     `searchMembers` y `findMemberDetailForOwner` con signatures +
     return type + `throw new Error('TODO M.3')` en el body. Permite
     que `members/public.server.ts` exporte ya y M.5 importe sin error.
   - `src/features/members/public.ts`: agrega exports stub de
     `promoteToAdminAction`, `demoteToMemberAction` con signature
     pero sin implementación (re-export de un módulo TODO).
   - `src/features/members/public.server.ts`: re-exporta los nuevos
     queries skeleton.
   - `src/features/shell/domain/settings-sections.ts`: agrega item
     `{ slug: 'access', label: 'Acceso' }` (1 línea). Posición:
     **antes de `'members'`** (semántica: "Acceso" es admin
     workflows, "Miembros" es directorio — el orden refleja
     jerarquía de uso).
   - Verifica `pnpm typecheck` + `lint` verde antes de fan-out.
4. **Agentes paralelos — M.2 + M.3**:
   - **Agente A (M.2)**: implementa el slice `tier-memberships/`
     completo. NO toca members ni shell. Termina con typecheck +
     lint + tests verde.
   - **Agente B (M.3)**: rellena los stubs de members con
     implementación real + actions `promote/demote` + tests.
     Termina con typecheck + lint + tests verde.
5. **Lead — Integración post-M.2/M.3**: typecheck + lint + suite
   completa de tests. Si rompe, identifica conflict y resuelve.
6. **Lead — M.4 (secuencial)**: rename `/settings/members/page.tsx`
   → `/settings/access/page.tsx`. Mueve componentes asociados,
   actualiza imports. Suma lista read-only mini para admin.
   Tests del nav (settings-nav-fab.test.tsx + settings-sections.test.ts)
   actualizados. typecheck + lint + tests verde.
7. **Agentes paralelos — M.5 + M.6** (audit detectó: pueden
   paralelizar — no comparten archivos, distintas rutas):
   - **Agente C (M.5)**: directorio `/settings/members/page.tsx` +
     `<MemberSearchBar>` + `<MemberFilters>` + `<MembersList>`.
     Importa de `members/public.server` y `tier-memberships/public(.server)`.
   - **Agente D (M.6)**: detalle `/settings/members/[userId]/page.tsx`
     - `<TierAssignmentControl>` + `<RoleSelectorDialog>`. Mismas
       importaciones.
   - Ambos agentes comparten dependencia READ-ONLY de los slices —
     no se tocan.
8. **Lead — Integración post-M.5/M.6**: typecheck + lint + tests
   verde. Manual smoke owner+admin+member.
9. **Lead — M.7 (secuencial)**: E2E + fixtures + cleanup + build prod.

Cada sub-fase termina con typecheck + lint + tests + build verde.

**Tiempo total**: ~9 sesiones (igual al plan original), pero con
paralelización máxima robusta (4 agentes en 2 batches).

## Critical files

**Nuevos**:

- `prisma/migrations/<ts>_tier_memberships_schema/migration.sql`
- `src/features/tier-memberships/` (~10 archivos según estructura).
- `src/app/[placeSlug]/settings/access/page.tsx` (rename + cleanup
  del actual `/settings/members/page.tsx`).
- `src/app/[placeSlug]/settings/members/page.tsx` (nuevo, directorio).
- `src/app/[placeSlug]/settings/members/[userId]/page.tsx` (nuevo, detalle).
- `docs/features/tier-memberships/spec.md`
- `docs/decisions/2026-05-02-tier-memberships-model.md`
- `tests/e2e/flows/members-directory.spec.ts`

**Modificados**:

- `prisma/schema.prisma` — modelo `TierMembership` + back-relations
  en `Tier`, `User`, `Place`.
- `src/features/members/server/queries.ts` — nuevas queries
  `searchMembers`, `findMemberDetailForOwner`.
- `src/features/members/server/actions/` — nuevas
  `promoteToAdminAction`, `demoteToMemberAction`.
- `src/features/members/public.ts` + `public.server.ts` — exponer
  los nuevos exports.
- `src/features/shell/domain/settings-sections.ts` — agregar
  `{ slug: 'access', label: 'Acceso' }` (sin `requiredRole`)
  **inmediatamente antes** del item `'members'` en el array.
  Razón semántica: "Acceso" agrupa workflows de admin (invitar,
  pending, transfer, leave) — operativos antes de gestionar el
  directorio. El item existente `'members'` queda con
  `requiredRole: 'owner'` (cambia visibilidad: ya no admin).
- `src/features/shell/__tests__/settings-sections.test.ts` — tests
  del nuevo orden + filtrado.
- `src/features/shell/__tests__/settings-nav-fab.test.tsx` — tests
  de visibilidad del item `'access'` para admin/owner.
- `src/app/[placeSlug]/settings/layout.tsx` — chequear que el gate
  sigue funcionando (admin-or-owner).
- `tests/fixtures/e2e-data.ts` — exportar IDs de asignaciones
  baseline (1-2 TierMembership en palermo).
- `tests/fixtures/e2e-seed.ts` — wipe + create de las baseline
  asignaciones.

## Helpers / patterns reusados (no duplicar)

- `findPlaceOwnership(userId, placeId)` (`@/shared/lib/identity-cache`)
  — owner gate en server actions.
- `findMemberPermissions(userId, placeId)` (`@/features/members/public.server`)
  — gate en pages.
- `loadPlaceBySlug` / `loadPlaceById` (`@/shared/lib/place-loader`)
  — request-scoped cache.
- `tierDurationToDays(duration)` (`@/features/tiers/public`) —
  cálculo de `expiresAt` automático.
- Patrón **discriminated union return** para errores esperados
  (gotcha CLAUDE.md actualizado 2026-05-02). Aplicar en
  `assignTierToMemberAction` (errores: `tier_not_published`,
  `tier_already_assigned`) y en `promoteToAdminAction`
  (`already_admin`).
- Patrón de form dialog con `useTransition` + pending state
  (`library/ui/admin/category-form-dialog.tsx` o
  `tiers/ui/tier-form-dialog.tsx`).
- Patrón de tests de actions con mocks granulares Prisma
  (`tiers/__tests__/actions.test.ts`).
- Patrón de E2E con worker isolation
  (`tests/e2e/flows/tiers.spec.ts`).
- Patrón de URL state para filtros: ver
  `discussions/ui/thread-filter-pills.tsx`.

## Riesgos + mitigaciones

| Riesgo                                                                                                           | Severity | Mitigación                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner se asigna tier a sí mismo (caso edge)                                                                      | 🟢       | Permitir — útil para testing UX. Sin restricción.                                                                                                                                                             |
| Owner intenta degradar a otro owner (asignar role MEMBER a userOwner)                                            | 🟡       | `demoteToMemberAction` chequea que el target NO sea owner via `findPlaceOwnership`. Si lo es, devuelve `{ ok: false, error: 'cannot_demote_owner' }` (el owner debe transferir ownership primero).            |
| Owner remueve la asignación de tier de otro owner                                                                | 🟢       | Permitir — la asignación de tier no implica ownership.                                                                                                                                                        |
| Asignar tier a miembro que ya lo tiene                                                                           | 🟡       | `@@unique([tierId, userId])` previene a nivel DB. Action retorna `{ ok: false, error: 'tier_already_assigned' }` (catch P2002).                                                                               |
| Asignar tier HIDDEN                                                                                              | 🟡       | Server action valida `tier.visibility === 'PUBLISHED'`. Si HIDDEN → `{ ok: false, error: 'tier_not_published' }`. UI dropdown filtra automáticamente a PUBLISHED.                                             |
| Search performance en place con 150 miembros                                                                     | 🟢       | `ILIKE` con index en `User.displayName` es OK para 150 rows. Cuando crezca el número, evaluar pg_trgm.                                                                                                        |
| Admin pierde visibilidad de "quién está" si el directorio queda owner-only                                       | 🟡       | Mantener lista read-only mini en `/settings/access` (decisión #12 plan, opt-in del user al revisar).                                                                                                          |
| Bookmarks viejos a `/settings/members` aterrizan en el directorio (404 para admin que esperaba la page anterior) | 🟡       | Aceptado para v1. El admin que pierde acceso ve 404 y reaprende el path — comunicable en release notes. Si la fricción aparece en el feedback, sumar redirect 308 desde un middleware en plan futuro.         |
| `expiresAt` se persiste pero v1 no la enforce (sin cron)                                                         | 🟡       | Documentado en spec como "campo informativo v1, enforcement en Fase 3 con Stripe". UI muestra el `expiresAt` con label "expira el X" pero no bloquea acceso.                                                  |
| Audit log pierde semántica si el assigner pasa por erasure 365d                                                  | 🟠       | Resuelto vía `assignedBySnapshot Json` en el schema (patrón canónico Post/Comment/Flag/Event). El UI consume el snapshot, no el join al User. Test E2E para erasure-then-display documenta el comportamiento. |
| `searchMembers` con full-table-scan en places grandes                                                            | 🟠       | Resuelto vía `@@index([displayName])` en User en M.1. Para 150 miembros × N places, el index hit + filtro por placeId es O(log n). Si crece a >1000 miembros por place, evaluar `pg_trgm` en plan futuro.     |
| Race en `assignTierToMemberAction` cuando dos owners asignan simultáneamente                                     | 🟢       | `@@unique([tierId, userId])` previene a nivel DB. Action catch P2002 → `{ ok: false, error: 'tier_already_assigned' }`.                                                                                       |
| Owner intenta asignar tier a ex-miembro (`leftAt IS NOT NULL`)                                                   | 🟡       | Pre-check en action: `target_user_not_member` → discriminated union return. UI dropdown filtra a miembros activos.                                                                                            |
| `findMemberDetailForOwner` ejecuta N queries en lugar de 1                                                       | 🟠       | Resuelto vía `include` explícito en una sola call. Test verifica con Prisma spy que es 1 query. Documentado en signature.                                                                                     |
| Query params del directorio (`?q=...&role=...`) sin validación                                                   | 🟠       | Resuelto vía `MemberSearchParamsSchema` Zod en M.5 (alineado con CLAUDE.md "Validación con Zod para todo input externo").                                                                                     |

## Alineación con CLAUDE.md y architecture.md

- ✅ **Vertical slices** (architecture.md § "Reglas de aislamiento"):
  nuevo slice `tier-memberships/` autocontenido con `public.ts` +
  `public.server.ts`. Imports cross-slice solo de `tiers/public(.server)`
  y `members/public(.server)` — unidirección, sin ciclos.
- ✅ **Spec antes de código** (CLAUDE.md): M.0 entrega `spec.md` y
  ADR antes de M.1. Cross-reference en el ADR al
  `docs/decisions/2026-05-02-tier-model.md` § decisión #1 (owner-only
  para tiers — extiende a tier-memberships con misma lógica).
- ✅ **TDD obligatorio**: cada sub-fase con tests primero (dominio
  en M.2, actions en M.2 y M.3, UI/E2E en M.5/M.6/M.7).
- ✅ **Caps de tamaño** (architecture.md): cada archivo del slice
  estimado < 200 LOC. Slice total estimado < 1500 LOC.
- ✅ **Sin libertad arquitectónica** (CLAUDE.md): respeto a las
  decisiones cerradas por user (separar tier de grupos, owner-only,
  page dedicada, slice nuevo).
- ✅ **Idioma**: comments + UI labels en español, código en inglés.
- ✅ **Validación Zod sobre todo input externo** (CLAUDE.md): server
  actions parsean input + query params del directorio
  (`MemberSearchParamsSchema`).
- ✅ **Tipos estrictos**: sin `any`. Discriminated unions explícitos
  con `{ ok: true | false; error?: '<discriminator>' }`.
- ✅ **Server Components default** (CLAUDE.md): list, detail, page
  son RSC. Solo form dialog, selector de rol y remove button son
  Client islands.
- ✅ **Tailwind solo layout/spacing**: sin colores hardcodeados.
- ✅ **Owner-only doble gate (v1)**: server action con
  `findPlaceOwnership` + UI gate `perms.isOwner`. RLS suma triple
  gate cuando llegue plan unificado.
- ✅ **Discriminated union return** para errores esperados (gotcha
  CLAUDE.md 2026-05-02). Aplicado en `assignTierToMemberAction`,
  `removeTierAssignmentAction`, `promoteToAdminAction`,
  `demoteToMemberAction`.
- ✅ **Patrón snapshot para erasure 365d**: `assignedBySnapshot Json`
  preserva audit info incluso después de que el assigner pase por
  erasure. Mismo patrón que `Post.authorSnapshot`,
  `Comment.authorSnapshot`, `Flag.reporterSnapshot`,
  `LibraryItem.authorSnapshot`. Cross-reference:
  `docs/decisions/2026-04-24-erasure-365d.md`.
- ✅ **Sin métricas vanidosas**: el directorio NO muestra "miembro
  más activo", "tier más popular" ni rankings. Sólo contadores
  útiles ("X miembros", "Y tiers asignados") como info de stock.
- ✅ **Identidad contextual**: el directorio muestra nombre, handle,
  avatar, joinedAt, role, isOwner, tiers — todo info contextual al
  place. NO email (decisión #6 user 2026-05-02 — privacidad).
- ✅ **Connection_limit gotcha** (CLAUDE.md): `findMemberDetailForOwner`
  es 1 query con `include`. `searchMembers` es 1 query con WHERE
  compuesto. Tests verifican con Prisma spy.

## Verificación

### Por sub-fase

- typecheck + lint + tests targeted al slice modificado.

### Cuando M.7 cierre (final)

- typecheck + lint + suite completa (Vitest + E2E). RLS suite no
  aplica (deferida).
- Build prod limpio.
- Manual smoke en dev local:
  1. Owner entra a `/settings/access` → ve invitar/pending/transfer/leave
     - lista read-only mini.
  2. Admin entra a `/settings/access` → ve invitar/pending/leave +
     lista (sin transfer).
  3. Admin entra a `/settings/members` → 404.
  4. `<SettingsNavFab>` para admin: ve `Acceso`, no ve `Miembros`.
  5. Owner entra a `/settings/members` → ve directorio con search +
     filtros + lista de todos los miembros (read-only en lista).
  6. Owner busca por nombre "ana" → lista filtrada.
  7. Owner aplica filtro "Rol = Admin" → solo admins.
  8. Owner aplica filtro "Antigüedad = Últimos 30 días" → recientes.
  9. Owner click en un miembro → page detalle `/settings/members/[id]`.
  10. Owner ve info del miembro: nombre, handle, avatar, joinedAt,
      role, isOwner, tiers asignados (vacío inicialmente).
  11. Owner asigna tier "Premium" con checkbox indefinido = false →
      `expiresAt` calculado automáticamente. Toast: "Tier asignado."
  12. Owner remueve la asignación → toast: "Tier removido."
  13. Owner asigna tier "Colaboradores" con indefinido = true →
      `expiresAt = null`.
  14. Owner intenta asignar el mismo tier dos veces → toast: "Este
      miembro ya tiene este tier asignado."
  15. Owner promueve un MEMBER a ADMIN → role badge cambia.
  16. Owner intenta degradar a otro owner → toast: "Este usuario
      es owner. Transferí la ownership primero."
  17. Owner click "Volver" → vuelve al directorio.
- E2E spec cubre 10+ escenarios: owner directorio happy path
  (search + filtros), asignar tier indefinido, asignar tier con
  expiración, conflict por tier ya asignado, conflict por tier
  HIDDEN, conflict por target_user_not_member (asignar a ex-miembro),
  promote MEMBER → ADMIN, demote ADMIN → MEMBER, error
  cannot_demote_owner, gate admin (404 en directorio), gate member
  (404 en /settings/members), URL state preserva filtros tras
  navegación. Tests RTL validan ambos toasts genérico y específico.

## Próximo paso

Si el plan se aprueba, arrancamos con **M.0**: spec + ADR del modelo.
NO escribir código en M.0.

Secuencia ejecutable:

1. **M.0** (lead): spec.md + ADR (sólo docs).
2. **M.1** (lead): schema + migration cloud dev + Prisma generate.
3. **M.1.5** (lead, ~15 min): pre-setup de stubs compartidos para
   permitir paralelismo seguro post-M.1.
4. **M.2 + M.3** (agentes A + B en paralelo): slice
   `tier-memberships/` y extension de `members/` simultáneamente.
   Cada uno typecheck + lint + tests verde antes de cerrar.
5. **Lead**: integración + verificación.
6. **M.4** (lead): rename + nav + lista mini.
7. **M.5 + M.6** (agentes C + D en paralelo): directorio y
   detalle simultáneamente.
8. **Lead**: integración + smoke manual.
9. **M.7** (lead): E2E + fixtures + build prod.

**Tiempo total estimado**: 9.25 sesiones (5 lead + 4.25 paralelas
con 4 agentes en 2 batches).
