# Modelo de permisos library v2 — read + write como dimensiones independientes

**Fecha:** 2026-05-12
**Milestone:** preparatoria para refactor de `/settings/library` admin
**Autor:** Max + Claude
**Status:** Decidido (reemplaza el modelo `ContributionPolicy`).

## Contexto

El admin actual de library tiene un modelo de permisos que mezcla en una sola dimensión cosas distintas:

```prisma
enum ContributionPolicy {
  ADMIN_ONLY      // legado, hoy sin uso (default movió a DESIGNATED)
  DESIGNATED      // usuarios listados explícitamente
  MEMBERS_OPEN    // cualquier miembro puede escribir
  SELECTED_GROUPS // grupos seleccionados (sumado en 2026-05-04, ADR
                  //  `library-contribution-policy-groups`)
}
```

El **read access** ya estaba bien modelado con dimensiones explícitas
(2026-05-04, ADR `library-courses-and-read-access`):

```prisma
enum ReadAccessKind { PUBLIC, GROUPS, TIERS, USERS }
```

con 3 tablas pivote (`LibraryCategoryGroupReadScope`,
`LibraryCategoryTierReadScope`, `LibraryCategoryUserReadScope`).

**Pero la dimensión de write quedó asimétrica**:

- No existía la opción "solo owner" como concepto explícito (el legado
  `ADMIN_ONLY` no se exponía en UI; el default actual `DESIGNATED` con
  lista vacía cumple un rol parecido pero ambiguo).
- No existía la opción "N tiers pueden escribir" — la matriz quedó como
  `DESIGNATED` (users) + `SELECTED_GROUPS` (groups), sin tiers.
- `MEMBERS_OPEN` (cualquier miembro escribe) está conceptualmente fuera
  de lugar — en un place pequeño íntimo, "cualquiera puede crear
  contenido editorial" no es un caso real que el producto quiera ofrecer
  como knob explícito.

Durante el rediseño de `/settings/library` (2026-05-12), el user clarificó
qué quiere administrar:

> Cuando el owner crea una categoría debe indicar:
>
> - Icono
> - Nombre
> - **Permiso de lectura**: público / N usuarios / N tiers / N grupos
> - **Permiso de escritura**: solo owner / N usuarios / N tiers / N grupos

Es decir: **dos dimensiones independientes, simétricas, con las mismas
4 opciones cada una**. Y el caso "cualquier miembro puede escribir" se
elimina del producto (no se ofrece como knob).

## Decisión

Modelar permisos de library como **dos enums independientes**
(`ReadAccessKind` ya existente, `WriteAccessKind` nuevo) **con 6 tablas
pivote** (3 read + 3 write) de shape idéntico:

```prisma
enum ReadAccessKind {
  PUBLIC      // todos los miembros activos del place
  GROUPS      // restringido a N groups
  TIERS       // restringido a N tiers
  USERS       // restringido a N users
}

enum WriteAccessKind {           // NEW (reemplaza ContributionPolicy)
  OWNER_ONLY  // solo owner del place — default restrictivo
  GROUPS      // N groups
  TIERS       // N tiers — NEW como dimension de write
  USERS       // N users
}

model LibraryCategory {
  // ... resto idéntico ...
  readAccessKind  ReadAccessKind  @default(PUBLIC)
  writeAccessKind WriteAccessKind @default(OWNER_ONLY)

  groupReadScopes  LibraryCategoryGroupReadScope[]
  tierReadScopes   LibraryCategoryTierReadScope[]
  userReadScopes   LibraryCategoryUserReadScope[]
  groupWriteScopes LibraryCategoryGroupWriteScope[]  // rename de GroupCategoryScope
  tierWriteScopes  LibraryCategoryTierWriteScope[]   // NEW
  userWriteScopes  LibraryCategoryUserWriteScope[]   // rename de LibraryCategoryContributor
}
```

Eliminado del schema:

- Enum `ContributionPolicy` completo.
- Tabla `LibraryCategoryContributor` (con metadata `invitedAt + invitedByUserId`).
- Tabla `GroupCategoryScope`.
- Concepto `MEMBERS_OPEN` (no se ofrece como knob de producto).

### Owner bypass

El owner del place **siempre** puede leer + escribir cualquier categoría,
independientemente de los scopes. Implícito en queries — no se modela
en pivots (sería redundante y fuente de drift).

### Write implica read

Si X (user/tier/group) tiene write access a una categoría, X tiene read
access automáticamente. Implícito en queries:

```ts
function canRead(category, viewer) {
  return (
    isOwner(viewer) ||
    isInWriteScope(category, viewer) || // write implies read
    isInReadScope(category, viewer)
  )
}
```

**No se denormaliza** en pivots (no se materializa la implicación
agregando filas write → read). Razón: single source of truth — la
relación es lógica, no de datos.

**En UI**: el form previsualiza la implicación. Si el owner elige "X
tier puede escribir", el step de read access muestra a X como
pre-checked (y avisa "ya tiene read por write access").

### Permisos a nivel categoría

Los items dentro de una categoría heredan los permisos de la categoría —
no tienen permisos individuales. Si un user pierde acceso a la
categoría (sale del tier, owner removió el user del scope, etc.),
pierde acceso a **todos los items** dentro. Decisión deliberada:
granularidad por-item explota el modelo mental sin valor proporcional.

### PUBLIC = todos los miembros del place

`PUBLIC` significa "cualquier miembro activo del place puede leer", no
"internet abierto". El gate de membership al place sigue siendo
prerequisito de cualquier acceso a content del place.

### OWNER_ONLY como default

El default del `writeAccessKind` al crear una categoría es `OWNER_ONLY`
(estado más restrictivo). El owner explícitamente decide ampliarlo.
Esto invierte el default histórico (donde `DESIGNATED` con lista vacía
era pseudo-equivalente).

## Alternativas consideradas

**(a) Modelo unificado `AccessControlList`** — una sola tabla pivote
genérica `LibraryCategoryAccess { categoryId, subjectKind, subjectId, permission }`
con discriminator. **Descartado** porque (1) confunde dimensiones de
read y write en queries (siempre hay que filtrar por permission), (2)
pierde type safety en client, (3) shape tan abstracto que cualquier
nueva feature (delegated access, expiry, etc.) entra al mismo bag sin
estructura.

**(b) Permisos a nivel item** — `LibraryItem.readAccessKind +
writeAccessKind` por item. **Descartado** (decisión user explícita):
explosión de granularidad, modelo mental difícil de comunicar, casi
nunca un caso real.

**(c) Heredar permisos del Place** — categorías sin permisos propios,
heredan los del place. **Descartado**: cada categoría debe ser
configurable (e.g. una categoría "Onboarding" pública vs una "Estrategia
2026" restringida a un tier).

**(d) Mantener `MEMBERS_OPEN` como opción** — se descartó porque va
contra el principio "customización activa" — un place editorial pequeño
e íntimo no necesita "cualquier miembro escribe" como knob. Si el owner
quiere todos puedan escribir, define un tier "miembros activos" que
cubra todos los miembros (caso patológico, pero modelado correctamente).

## Cambios concretos (plan)

Implementación se ejecuta en 4 sesiones documentadas en
`docs/plans/2026-05-12-library-permissions-redesign.md`:

- **S0** (esta sesión): ADR + spec update.
- **S1**: schema + migration + queries + actions + RLS + tests.
- **S2**: wizard UI con read access step + write access step.
- **S3**: migrar admin page a wizard + cleanup legacy + decisión final
  de layout (master-detail vs EditPanel).

### Migration

**Drop completo** de categorías existentes (estamos en dev,
decisión user). No hay migration suave de `ContributionPolicy →
WriteAccessKind`. Específicamente:

```sql
DROP TABLE "LibraryCategoryContributor" CASCADE;
DROP TABLE "GroupCategoryScope" CASCADE;
DELETE FROM "LibraryCategory";  -- limpia rows existentes
-- recrear LibraryCategory con writeAccessKind, sin contributionPolicy
DROP TYPE "ContributionPolicy";
CREATE TYPE "WriteAccessKind" AS ENUM (
  'OWNER_ONLY', 'GROUPS', 'TIERS', 'USERS'
);
CREATE TABLE "LibraryCategoryGroupWriteScope" (
  "categoryId" TEXT NOT NULL REFERENCES "LibraryCategory"(id) ON DELETE CASCADE,
  "groupId"    TEXT NOT NULL REFERENCES "PermissionGroup"(id) ON DELETE CASCADE,
  PRIMARY KEY ("categoryId", "groupId")
);
CREATE TABLE "LibraryCategoryTierWriteScope" (
  "categoryId" TEXT NOT NULL REFERENCES "LibraryCategory"(id) ON DELETE CASCADE,
  "tierId"     TEXT NOT NULL REFERENCES "Tier"(id) ON DELETE CASCADE,
  PRIMARY KEY ("categoryId", "tierId")
);
CREATE TABLE "LibraryCategoryUserWriteScope" (
  "categoryId" TEXT NOT NULL REFERENCES "LibraryCategory"(id) ON DELETE CASCADE,
  "userId"     TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  PRIMARY KEY ("categoryId", "userId")
);
```

### RLS

`LibraryItem SELECT`: hoy el RLS asume "cualquier miembro del place ve
items no archivados". Con el modelo nuevo de read access, el RLS debe
chequear el scope de la categoría. Branches:

- `category.readAccessKind = 'PUBLIC'` → cualquier miembro.
- `category.readAccessKind = 'GROUPS'` → miembro de algún grupo en `LibraryCategoryGroupReadScope`.
- `category.readAccessKind = 'TIERS'` → miembro de algún tier en `LibraryCategoryTierReadScope`.
- `category.readAccessKind = 'USERS'` → user en `LibraryCategoryUserReadScope`.
- Owner del place: bypass siempre.
- Write implica read: si está en write scope (cualquier de los 3), bypass.

`LibraryItem INSERT`: similar para write access (con `OWNER_ONLY` el
único que puede insertar es owner; el resto vía scopes).

Implementación: helper SQL `is_in_category_read_scope(category_id, user_id)`
y `is_in_category_write_scope(category_id, user_id)` para no duplicar
lógica en cada policy.

### Audit

Las pivots write no llevan `invitedAt + invitedByUserId` (la legacy sí
tenía). Decisión: **no se preserva audit** en v1. Si emerge requirement,
se suman columns sin breaking change.

## Trade-offs aceptados

- **Drop destructivo en dev**: las categorías legacy se pierden. Mitigado
  por estar en dev (no producción, decisión user).
- **6 tablas pivote** vs 1 genérica: más DDL, mejor type safety + RLS
  más limpio. Net positivo.
- **MEMBERS_OPEN eliminado**: pierde grado de libertad para casos
  patológicos. Net positivo (alinea con principios producto).
- **Sin audit en pivots**: pierde trazabilidad de "quién agregó a X
  como contributor cuándo". Se acepta — si emerge, agregar columns.
- **Owner del place que cambia**: si el owner transfiere ownership a
  otro user, las categorías con `writeAccessKind: OWNER_ONLY` siguen
  siendo accesibles solo por el owner ACTUAL (chequeo runtime contra
  `PlaceOwnership`). Esto es coherente con la semántica del enum
  (OWNER_ONLY = quien tenga el rol owner ahora, no el que lo creó).

## Referencias

- `docs/decisions/2026-05-02-permission-groups-model.md` — modelo de groups.
- `docs/decisions/2026-05-02-tier-model.md` — modelo de tiers.
- `docs/decisions/2026-05-04-library-contribution-policy-groups.md` — adición
  de `SELECTED_GROUPS` (este ADR lo reemplaza con `WriteAccessKind.GROUPS`).
- `docs/decisions/2026-05-04-library-courses-and-read-access.md` — modelo de
  `ReadAccessKind` (queda como está, sólo se le suma la dimensión write).
- `docs/plans/2026-05-12-library-permissions-redesign.md` — plan de las 4
  sesiones de implementación.
- `docs/features/library/spec.md` § 10–§ 11 — modelo y matriz de permisos
  (actualizados en S0 con este ADR).
