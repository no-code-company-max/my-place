# Modelo de datos del feature Tier

**Fecha:** 2026-05-02
**Estado:** Aceptada
**Origen:** T.0 del plan Tier (`docs/features/tiers/spec.md`).

## Contexto

El producto necesita una primitiva **Tier** — segmentos de
usuarios con precio + duración + visibilidad — que más adelante
habilite al **owner** del place a monetizar su comunidad. Esta
primera fase **sólo construye la primitiva**: definición + CRUD

- visibilidad. NO toca pagos, NO asigna tiers a usuarios.

El plan completo está en `docs/features/tiers/spec.md`. Este ADR
registra las decisiones de modelado que abrieron debate y se
cerraron antes de implementar.

## Decisiones

### 1. Owner-only — admin NO califica

Sólo el owner del place (registro en `PlaceOwnership`) puede
crear/editar/cambiar visibilidad de tiers. Admin (`Member.role =
'ADMIN'`) NO. Razones:

- **Estructura de pricing es decisión comercial del owner**, no
  operativa. Admin gestiona el día a día (members, hours, flags,
  library); pricing tiene implicaciones de negocio que sólo el
  owner debe poder mover.
- **Defense-in-depth**: triple gate cuando llegue RLS (server
  action + UI gate + RLS policy). v1 entrega doble gate (server
  action `findPlaceOwnership` + UI gate `perms.isOwner`); RLS
  suma el tercero cuando llegue el plan unificado.
- **Coherencia con `transferOwnershipAction`**: la transferencia
  de ownership ya es owner-only. Tier sigue el mismo patrón.

Implicancia: el caller del settings nav debe saber si el viewer
es owner. `findMemberPermissions` ya retorna
`{ role, isOwner }` — es 1 prop al `<SettingsNavFab>`.

### 2. Visibilidad binaria — sin estados intermedios

`PUBLISHED | HIDDEN`. Sin `DRAFT`, sin `SCHEDULED`. Razones:

- v1 no tiene paywall ni asignación — los tiers son visibles
  sólo en `/settings/tiers` (owner). HIDDEN sólo afecta al
  futuro pricing page público.
- Estados intermedios (`DRAFT`, `SCHEDULED`) son scope creep —
  agregan complejidad de transition matrix sin caso de uso v1.
- Si producto pide programar publicación a futuro, se evalúa en
  v2 con un campo `publishAt` opcional, sin romper el modelo
  actual.

### 3. Sin `archivedAt` en v1

El campo `visibility` cubre el caso "deshabilitar tier sin
perderlo". Archive verdadero (con FK constraint a respetar) se
evalúa en v2 cuando exista `TierMembership`. Razones:

- Sin suscripciones activas, no hay nada que proteger contra
  delete físico.
- Agregar `archivedAt` ahora implica decidir la semántica
  archive vs hidden — prematuro sin caso de uso real.

### 4. Currency hardcoded `'USD'` v1, allowlist v2

Schema reserva `currency String @db.VarChar(3) @default("USD")`
para que el modelo no cambie cuando llegue Stripe Connect. Zod
v1 valida `z.enum(['USD'])`. Razones:

- **Stripe Connect Express en LATAM solo soporta USD/BRL/MXN**.
  ARS no está disponible — no tiene sentido permitirlo en v1.
- Hardcoded simplifica el form (sin selector) y los tests.
- Cuando llegue Stripe Connect, se extiende el enum
  (`z.enum(['USD', 'BRL', 'MXN'])`) sin tocar la migración.

### 5. Precio en centavos, max 999_999

`priceCents Int` en DB. Zod v1 valida `min(0).max(999_999)`
($0–$9,999.99). Razones:

- **Centavos evita float drift** (estándar para cualquier
  moneda).
- `priceCents = 0` ⇒ tier gratis ("Gratis" en UI). Caso de uso:
  "colaboradores", "early access".
- Cap defensivo `999_999` contra typos (un owner que
  accidentalmente pone $99,999 en vez de $99). Ajustable cuando
  llegue Stripe (Stripe permite hasta $999,999.99 por monto
  individual).

### 6. Duración como enum cerrado de 6 valores

`SEVEN_DAYS | FIFTEEN_DAYS | ONE_MONTH | THREE_MONTHS |
SIX_MONTHS | ONE_YEAR`. Razones:

- **Cierra superficie de UX**: form con 6 opciones radio/select
  vs input numérico abierto. Less misuse.
- **Mapeo determinístico a Stripe billing intervals**: cuando
  llegue Stripe Connect, cada valor se traduce a `interval` +
  `interval_count` sin ambigüedad.
- **Enum vs columna `int days`**: un día arbitrario (e.g. 13
  días) no es un caso de uso real. Si producto pide duraciones
  custom, el enum se extiende con valores nuevos — más
  predecible que validar un int abierto.

Helper puro `tierDurationToDays(duration: TierDuration): number`
deriva días concretos cuando se necesite (cálculos de
expiración futuros).

### 7. Settings nav con `requiredRole` opcional + helper en data layer

`SETTINGS_SECTIONS` items ganan campo opcional `requiredRole?:
'owner' | 'admin'`. Default ausente = visible a admin-or-owner
(comportamiento actual). El **gate vive en la data layer**, no
en el componente:

```ts
export function deriveVisibleSettingsSections(ctx: { isOwner: boolean }): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((s) => {
    if (s.requiredRole === 'owner') return ctx.isOwner
    return true
  })
}
```

Razones:

- **Componente "tonto"**: `<SettingsNavFab>` no decide
  visibilidad — sólo renderiza. Filtrado puro = testeable sin
  render.
- **Extensible**: cuando llegue otro item con `requiredRole:
'admin'` (raro hoy), la extensión es trivial.
- **Default permisivo retrocompatible**: items existentes sin
  `requiredRole` se ven siempre — ningún test existente se
  rompe.

### 8. Slice nuevo `tiers/` independiente

NO se integra al slice `places/` ni al `members/`. Razones:

- **Vertical slice puro** (CLAUDE.md): el feature tiene su
  propio dominio (tier, duration, visibility), sus propias
  invariants, su propia UI. Mezclarlo con `places/` infla un
  slice ya pesado.
- **Coherencia con `tier-memberships/` futuro**: cuando llegue
  la asignación, será un slice separado que importa `tiers/` —
  separación limpia entre "qué se ofrece" (tiers) y "quién está
  suscripto" (tier-memberships).

### 9. NO cap on tier count en v1

Owner puede crear los tiers que quiera. Razones:

- Cap arbitrario sin caso de uso real es prematuro.
- El cap soft del producto (150 miembros por place) acota
  naturalmente el número de tiers útiles.
- Si en testing surface exceso (>20 tiers), se suma cap en v2
  con migración additive.

### 10. Reglas de inmutabilidad post-create — diferidas a v2

| Campo         | v1               | v2 (con TierMembership)    |
| ------------- | ---------------- | -------------------------- |
| `name`        | editable siempre | editable siempre           |
| `description` | editable siempre | editable siempre           |
| `priceCents`  | editable siempre | **inmutable** post-publish |
| `currency`    | editable siempre | **inmutable** post-publish |
| `duration`    | editable siempre | **inmutable** post-publish |
| `visibility`  | editable siempre | editable siempre           |

Razones para v1 todo editable:

- Sin `TierMembership`, no hay semántica que romper. Editar
  precio en v1 no afecta a nadie.
- Inmutabilidad sin justificación = fricción innecesaria en una
  fase de planeamiento.

Razones para v2 inmutabilidad post-publish:

- Una suscripción activa al tier "Premium" $9.99/mes tiene un
  contrato implícito. Si el owner edita `priceCents` a $19.99,
  el sistema queda en estado ambiguo (¿se cobra al usuario el
  nuevo precio? ¿el viejo? ¿se requiere consent?).
- v2 va a forzar el flujo "archivar tier, crear nuevo con
  `replacedById`". Documentado como gotcha en este ADR.

### 11. Name NO unique global — pero máx 1 PUBLISHED por (placeId, name) lower-case

**Actualizada 2026-05-02 (post-implementación inicial)**.

NO se aplica `@@unique([placeId, name])` global. SÍ se aplica un
**partial unique index**:

```sql
CREATE UNIQUE INDEX "Tier_placeId_lowerName_published_unique"
  ON "Tier" ("placeId", LOWER("name"))
  WHERE "visibility" = 'PUBLISHED';
```

Razones:

- **Caso de uso real**: owner crea `"Basic" $1.99/mes` y lo
  publica. Después decide cambiar precio a `$2.99/mes` pero
  quiere mantener `"Basic" $1.99` vivo (oculto) por
  compatibilidad histórica futura (cuando exista `TierMembership`
  v2). Operación:
  1. Crear nuevo `"Basic" $2.99` (arranca HIDDEN — el partial
     unique no aplica porque sólo cubre `PUBLISHED`).
  2. Ocultar el `"Basic" $1.99` actual.
  3. Publicar el nuevo `"Basic" $2.99`.
     En cualquier momento del flow hay máximo UN "Basic" `PUBLISHED`.
- **Identidad del tier es el `id` cuid**, no el nombre. UI
  futura referenciará tiers por id (en `TierMembership.tierId`).
- **Implementación**:
  - `createTierAction` no chequea — los nuevos arrancan HIDDEN
    y nunca pueden violar el partial unique.
  - `updateTierAction` chequea sólo si el tier está `PUBLISHED`
    y el name cambia (case-insensitive). Catch P2002 como
    fallback contra race.
  - `setTierVisibilityAction` chequea al pasar a `PUBLISHED`.
    Catch P2002 como fallback.
  - Errores esperados → discriminated union return
    `{ ok: false, error: 'name_already_published' }`.
- **Sin `slug`**: los tiers no tienen URL pública dedicada. Se
  referencian por id en URLs internas. Si en futuro se necesita
  URL amigable, se agrega slug entonces.

**Por qué partial unique y no chequeo sólo en app**: defense in
depth. El index DB es atómico y resiste race conditions del app
layer. Si dos owners simultáneos intentan publicar dos `"Basic"`
distintos, el segundo recibe constraint violation Postgres → la
action lo mapea a `name_already_published`. Sin partial unique,
el race window es real (check-then-act).

**Iteración previa rechazada (2026-05-02 inicial)**: dedup global
del nombre case-insensitive en server action. Bloqueaba el caso de
uso anterior (no permitía dos `"Basic"` ni siquiera con uno
oculto). Reemplazado por el partial unique que sólo restringe
sobre `PUBLISHED`.

## Implicancias

- **Migración**: `prisma/migrations/<ts>_tiers_core_schema/` con
  el modelo + 2 enums + 2 indexes. Sin RLS (deferida al plan
  unificado de RLS).
- **Slice**: `src/features/tiers/` con domain, server, ui,
  schemas, public.ts/.server.ts. Estimado <1500 LOC, dentro del
  cap default.
- **Settings nav**: 1 prop nueva (`isOwner`) + 1 item nuevo en
  `SETTINGS_SECTIONS` + 1 helper de filtrado. Tests existentes
  no se rompen (default sin `requiredRole` = visible).
- **Helper `formatPrice` en shared**: anticipando reuso en
  pricing pages futuros, events ticketing futuro. Si tiers
  resulta el único consumidor a 6 meses, se mueve a
  `tiers/domain/`.
- **Boundaries**: `tests/boundaries.test.ts` no cambia — tiers
  no importa de otros features (sólo de `shared/`, `db/`).

## Cuándo revisar

- Cuando arranque el plan de Stripe Connect (Fase 3) — currency
  enum se extiende, priceCents cap puede subir, duration
  mapping a Stripe `interval`.
- Cuando arranque el plan de `TierMembership` — inmutabilidad
  post-publish entra en vigencia.
- Cuando llegue el plan unificado de RLS — se suma `Tier` con
  policies basadas en `is_place_owner()` + `is_active_member()`.
- Si en testing aparece exceso de tiers por place (>20) — se
  suma cap.

## No aplica

Este ADR **no** autoriza:

- Cobrar a usuarios sin Fase 3 implementada.
- Asignar tiers a miembros sin tabla `TierMembership`.
- Hard-delete de tiers (sólo soft via `visibility = HIDDEN`).
- Activar selector de currency sin Stripe Connect integrado.

## Referencias

- `docs/features/tiers/spec.md` — spec completa del feature.
- `docs/decisions/2026-05-01-stripe-deferred-to-phase-3.md` —
  billing como Fase 3.
- `docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md` —
  RLS unificado deferred.
- `prisma/schema.prisma` — modelo `Place`, `PlaceOwnership`,
  `Member`, `MembershipRole` (referencias del gate).
- `src/features/places/server/queries.ts` —
  `findPlaceOwnership`.
- `src/features/members/public.server.ts` —
  `findMemberPermissions`.
