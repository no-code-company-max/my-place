# Plan derivado — Extensión de cobertura del job Erasure 365d

**Fecha:** 2026-05-01
**Origen:** derivado de M5 (spec de flags). El user identificó que el job actual de erasure debería revisarse contra **todas** las entidades que mantienen identidad del ex-miembro, no solo Post/Comment.

## Estado actual del job (`src/features/members/server/erasure/run-erasure.ts`)

Verificado vía grep + read directo del archivo. El job actualmente cubre:

| Entidad      | Acción                                                     | Verificación      |
| ------------ | ---------------------------------------------------------- | ----------------- |
| `Post`       | `UPDATE authorUserId=NULL + authorSnapshot` ('ex-miembro') | ✅ líneas 199-203 |
| `Comment`    | `UPDATE authorUserId=NULL + authorSnapshot` ('ex-miembro') | ✅ líneas 205-209 |
| `Event`      | `UPDATE authorUserId=NULL + authorSnapshot` ('ex-miembro') | ✅ líneas 210-216 |
| `EventRSVP`  | `DELETE rows del place`                                    | ✅ líneas 218-225 |
| `Membership` | `UPDATE erasureAppliedAt=now()`                            | ✅ línea 226      |

**Importante**: el job NO borra la fila `User` — solo anonimiza el contenido authored y mantiene el User row vivo. Esto es lo correcto: un user puede pertenecer a múltiples places, y la erasure es **per-place**.

## Gaps identificados (entidades NO cubiertas)

Hice grep contra `prisma/schema.prisma` buscando todos los campos `userId | authorUserId | reporterUserId`. Las entidades con identidad del ex-miembro que el job actual NO toca son:

### G-E.1 — `LibraryItem.authorUserId` (MEDIUM)

- **Schema** (línea 490): `authorUserId String?` con `onDelete: SetNull`.
- **Estado**: el job NO ejecuta UPDATE sobre LibraryItem.
- **Impacto real**: la UI de `/library/[cat]/[slug]` muestra el author leyendo de **`Post.authorSnapshot`** (no de `LibraryItem.authorUserId`). Como Post ya está cubierto por erasure, **la UI del library item ya muestra "ex-miembro" correctamente**. Pero `LibraryItem.authorUserId` queda con el FK del ex-miembro intacto en DB → leak si alguien hace query directo.
- **Decisión propuesta**: extender el job con `UPDATE LibraryItem SET authorUserId = NULL WHERE authorUserId = $userId AND placeId = $placeId`. No necesita `authorSnapshot` separado (lo cubre el Post).
- **Riesgo del fix**: bajo. Sin migration. SetNull ya está en FK constraint.

### G-E.2 — `LibraryCategoryContributor.userId` (LOW-MEDIUM)

- **Schema** (línea 462): `userId String` (NOT NULL) con `onDelete: Cascade`.
- **Estado**: el job NO ejecuta DELETE sobre contributor rows del ex-miembro. Cascade sólo se dispara si el User row se borra, y erasure no lo borra.
- **Impacto**: la fila contributor queda viva con `userId` del ex-miembro. El user ya no es member del place (membership `leftAt` set), pero su row de contributor designado sigue → admin puede ver "designated contributor" listado para alguien que ya no está.
- **Decisión propuesta**: extender el job con `DELETE FROM LibraryCategoryContributor WHERE userId = $userId AND categoryId IN (SELECT id FROM LibraryCategory WHERE placeId = $placeId)`. Es permission, sin user activo no tiene sentido mantener el row.
- **Riesgo del fix**: bajo. Es una row de permiso, no historia.

### G-E.3 — `Reaction.userId` (MEDIUM — DECISIÓN DE PRODUCTO)

- **Schema** (línea 219): `userId String` (NOT NULL) con `onDelete: Restrict`.
- **Estado**: el job NO toca Reaction.
- **Impacto**: las reacciones del ex-miembro mantienen su `userId` en DB. La UI muestra reacciones agregadas (count + emoji), no el detalle de quién — por lo tanto no hay leak directo en UI. Pero el `userId` queda en DB.
- **Decisión pendiente**: 2 caminos:
  - **A — DELETE las reacciones del place**: `DELETE FROM Reaction WHERE userId = $userId AND placeId = $placeId`. Counts agregados bajan post-erasure. La huella del ex-miembro desaparece (consistente con principio "derecho al olvido").
  - **B — Mantener rows con userId del ex-miembro**: el agregado se preserva pero el `userId` leakea a quien query directo. Inconsistente con erasure de Post/Comment.
- **Recomendación**: **A (DELETE)**. Coherente con que los RSVPs del place se borran (línea 222 del job). Erasure es per-place — la huella se va con el user.
- **Riesgo del fix**: bajo. Counts post-erasure se recalculan al render natural.

### G-E.4 — `PostRead.userId` (LOW)

- **Schema** (línea 248): `userId String` con `onDelete: Restrict`.
- **Estado**: el job NO toca PostRead.
- **Impacto**: tracking de lectura del ex-miembro queda con `userId` en DB. La UI muestra "X miembros leyeron" como agregado + avatar stack (PostReadersBlock). Si el user salió, su avatar igual debería desaparecer.
- **Decisión propuesta**: `DELETE FROM PostRead WHERE userId = $userId AND postId IN (SELECT id FROM Post WHERE placeId = $placeId)`. Sin valor histórico relevante.
- **Riesgo del fix**: bajo.

### G-E.5 — `Flag.reporterUserId` (MEDIUM — REQUIERE MIGRATION)

- **Schema** (línea 267): `reporterUserId String` (**NOT NULL**) con `onDelete: Restrict`.
- **Estado**: el job NO toca Flag. Y el campo es NOT NULL → no se puede nullificar sin migration.
- **Impacto**: identidad del reporter persiste para siempre, incluso post-erasure. El user dijo explícitamente: "no necesitamos al menos de momento la identidad de quien reporta algo". Garantía deseada: post-erasure, ni el admin ve quién reportó.
- **Decisión propuesta**:
  - **Migration**: `reporterUserId String` → `reporterUserId String?` (nullable) + cambiar FK a `onDelete: SetNull`.
  - **Job**: `UPDATE Flag SET reporterUserId = NULL WHERE reporterUserId = $userId AND placeId = $placeId`.
  - **UI**: el admin queue debe handle `reporterUserId === null` (mostrar "ex-miembro" en lugar del avatar/nombre del reporter).
- **Riesgo del fix**: medio. Requiere migration + cambio en UI del admin queue + tests.

### G-E.6 — `Flag.reviewerAdminUserId` (LOW)

- **Schema** (línea 273): `reviewerAdminUserId String?` (nullable) con `onDelete: SetNull`.
- **Estado**: el job NO toca Flag. Pero ya es nullable.
- **Impacto**: bajo. El reviewer es admin, raramente sale del place. Si sale: `userId` queda intacto (no se nullifica automáticamente porque erasure no borra User).
- **Decisión propuesta**: `UPDATE Flag SET reviewerAdminUserId = NULL WHERE reviewerAdminUserId = $userId AND placeId = $placeId`. Sin migration (ya es nullable).
- **Riesgo del fix**: bajo.

## Decisiones pendientes de producto

Antes de implementar el fix, necesito tu confirmación en estas preguntas:

**Q1**: `Reaction` post-erasure → ¿DELETE las rows (counts bajan) o mantener (huella persiste)?

> Recomendación: **DELETE**, consistente con RSVPs ya borrados.

**Q2**: `Flag.reporterUserId` → ¿agregar migration que lo vuelva nullable + actualizar UI admin queue para mostrar "ex-miembro"?

> Recomendación: **sí**, cierra el invariante que documentaremos en spec de flags.

**Q3**: `LibraryCategoryContributor` post-erasure → ¿DELETE las rows (más limpio) o mantener (audit trail histórico)?

> Recomendación: **DELETE**. Es permission en vivo, no historia.

**Q4**: ¿Aplicar todos los fixes en una sesión única (~3-4h) o priorizar G-E.5 (Flag) que aclara el invariante de privacidad de la spec, y diferir el resto?

> Recomendación: **prioridad G-E.5 + G-E.1 (LibraryItem)** porque son los dos que tienen impacto visible en UI/leaks reales. G-E.2/3/4/6 pueden ir en una segunda pasada.

## Plan de implementación (cuando se confirmen las decisiones)

### Fase 1 — Migration (~30 min)

- Migration `*_erasure_coverage_extension/migration.sql`:
  - `ALTER TABLE "Flag" ALTER COLUMN "reporterUserId" DROP NOT NULL;`
  - `ALTER TABLE "Flag" DROP CONSTRAINT ...; ADD CONSTRAINT ... ON DELETE SET NULL;`
- Update `prisma/schema.prisma`: `reporterUserId String` → `reporterUserId String?`.

### Fase 2 — Extender el job (~1h)

`src/features/members/server/erasure/run-erasure.ts`, agregar dentro del `prisma.$transaction` por membership:

```ts
// Existing: Post, Comment, Event UPDATEs.
// Existing: EventRSVP DELETE.

// New: LibraryItem.authorUserId
await tx.$executeRaw`
  UPDATE "LibraryItem" SET "authorUserId" = NULL
  WHERE "authorUserId" = ${m.userId} AND "placeId" = ${m.placeId}
`

// New: LibraryCategoryContributor (DELETE)
await tx.libraryCategoryContributor.deleteMany({
  where: {
    userId: m.userId,
    category: { placeId: m.placeId },
  },
})

// New: Reaction (DELETE)
await tx.reaction.deleteMany({
  where: { userId: m.userId, placeId: m.placeId },
})

// New: PostRead (DELETE)
await tx.postRead.deleteMany({
  where: {
    userId: m.userId,
    post: { placeId: m.placeId },
  },
})

// New: Flag.reporterUserId
await tx.$executeRaw`
  UPDATE "Flag" SET "reporterUserId" = NULL
  WHERE "reporterUserId" = ${m.userId} AND "placeId" = ${m.placeId}
`

// New: Flag.reviewerAdminUserId
await tx.$executeRaw`
  UPDATE "Flag" SET "reviewerAdminUserId" = NULL
  WHERE "reviewerAdminUserId" = ${m.userId} AND "placeId" = ${m.placeId}
`
```

### Fase 3 — Tests (~1h)

- Extender `src/features/members/server/erasure/__tests__/run-erasure.test.ts` con 6 casos (1 por entidad nueva).
- Agregar al RLS test relevante el handling del `reporterUserId IS NULL`.
- E2E (si aplica) verificar que admin queue de flags muestra "ex-miembro" para reporters anonimizados.

### Fase 4 — UI (~30 min)

- `src/features/flags/ui/flag-queue-item.tsx` (o similar): si `flag.reporterUserId === null`, mostrar copy "ex-miembro" + avatar default.
- Documentar como invariante de privacidad en spec de flags (M5).

## Costo total estimado

- Si se confirma todo (Q1=DELETE, Q2=migration, Q3=DELETE, Q4=todo): **~3-4h** en 1 sesión.
- Si solo G-E.5 + G-E.1: **~2h**, el resto queda como follow-up explícito.

## Impacto en M5 (spec de flags)

La spec de flags (M5) está esperando este plan para resolver el invariante de privacidad ("post-erasure, identidad del reporter desaparece"). Hay 2 caminos:

- **A**: escribir M5 ahora describiendo el comportamiento **intencional** (post-erasure reporter es null), referenciando este plan como deuda explícita. La spec describe el target, el código catches up.
- **B**: implementar G-E.5 primero, después escribir M5 con el comportamiento ya activo.

Recomendación: **A**. La spec es contrato; el código ajusta. Mantener el flujo del checklist sin bloquear.

## Referencias

- `docs/decisions/2026-04-24-erasure-365d.md` — ADR original del job.
- `docs/plans/2026-05-01-audit-checklist.md` — origen de M5 que reveló este gap.
- `src/features/members/server/erasure/run-erasure.ts` — código actual.
- `prisma/schema.prisma` — todas las FKs de identidad.
