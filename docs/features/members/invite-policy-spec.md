# Invite Policy + Cuotas + Settings General del Place — Especificación

> **Estado:** spec de feature **NUEVA, no implementada**. El comportamiento de abajo fue **acordado con el owner** y vive en `docs/rls/membership-invitation.md` (§ "Quién puede invitar — CONFIGURABLE por place" + "Pendientes" #1 y #4) y `docs/rls/place-access.md`. Lo que NO esté en esos docs fuente está marcado explícitamente como **a definir con el owner** — no inventar.

> **Alcance:** (1) un **área de configuración general del place en `/settings`** (a crear — no existe hoy) que actúa como contenedor de configs a nivel place; (2) la **política de invitación** configurable por el owner (quién puede invitar) + **cuotas** por scope; (3) la **evaluación server-side** de "¿este actor puede invitar y le queda cuota?" previa a crear la `Invitation`. NO cubre el lifecycle de `Invitation` ni su RLS (`docs/features/members/spec.md` + `docs/rls/membership-invitation.md`), ni `discoverable` (`docs/features/places/spec.md`).

> **Referencias:** `docs/rls/membership-invitation.md` (fuente acordada — quién invita configurable), `docs/rls/place-access.md` (config del place owner-only, contenedor de `discoverable`), `docs/features/members/spec.md` (`inviteMemberAction`, invariante 150, `assertInviterHasRole`), `docs/features/places/spec.md` (`discoverable`, config owner-only, ADR `2026-05-02`), `docs/features/settings-shell/spec.md` (chrome de `/settings/*`, section "Acceso"), `docs/features/groups/spec.md`, `docs/features/tiers/spec.md`, `CLAUDE.md` (150 máx invariante de dominio, sin métricas vanidosas, spec antes de código).

## Modelo mental

- **El place decide quién deja entrar gente.** Por default un place es íntimo: la invitación nace restringida (a definir con el owner si el default es **owner-only** o **admin/owner** — ver "A definir"). El owner abre la puerta tanto como quiera, nunca más allá del invariante de dominio (150 miembros activos).
- **La política de invitación es customización activa, no algorítmica.** El owner la define explícitamente desde `/settings`. No hay heurística que "abra" el place según actividad ni nada por el estilo (coherente con CLAUDE.md § "Customización activa, no algorítmica").
- **Las cuotas son un límite de confianza, no una métrica.** Una cuota responde "¿cuántas invitaciones le confío a este scope?". NO se muestran contadores vanidosos ("32 invitaciones usadas este mes", rankings de quién más invitó). El miembro ve, a lo sumo, **cuántas invitaciones le quedan disponibles a él** (su propio cupo restante), nunca un leaderboard ni el consumo ajeno. El admin/owner ve el estado de cuotas en settings porque lo necesita para configurar — eso es chrome admin, no superficie de brand.
- **La política se evalúa en el servidor, no en RLS.** La RLS de `Invitation` ya está resuelta (INSERT = deny, escritura service-role; SELECT = invitee-o-admin). Quién-puede-invitar + cuota disponible son **lógica app-layer** previa al INSERT, porque son configurables y tienen estado de consumo — no modelables en una policy estática (`docs/rls/membership-invitation.md` § "RLS derivada", fila INSERT de `Invitation`).
- **El área de settings general del place es el contenedor.** La invite-policy es la primera config "a nivel place" que vive ahí, pero el área también contiene/contendrá otras configs del place (ej. el toggle `discoverable` que ya existe como campo y cuya semántica vive en `docs/features/places/spec.md` — acá NO se re-especifica).

## Scope del slice

Este slice entrega:

1. **Área de settings general del place** (`/settings`, sub-page a definir el path exacto — ver "A definir") — contenedor owner-only de configs a nivel place. En esta entrega aloja la UI de la invite-policy. Se apoya en el chrome ya especificado en `docs/features/settings-shell/spec.md` (sidebar / FAB / content area); este slice aporta una sub-page nueva, no rediseña el shell.
2. **Modelo de datos de la invite-policy + cuotas** (PROPUESTO — ver "Modelo de datos PROPUESTO", sujeto a revisión).
3. **Server actions de configuración** (owner-only) para leer y escribir la política y las cuotas del place.
4. **Evaluación server-side `assertActorCanInvite(actorId, placeId)`** (nombre propuesto) — gate app-layer que `inviteMemberAction` invoca **antes** de crear la `Invitation`, reemplazando/extendiendo el actual `assertInviterHasRole` (ver "Comportamiento" § Integración).
5. **Lectura del cupo restante propio** para la UI de invitar (cuánto le queda al actor).

Fuera de este slice (se entregan / viven en otros lugares):

- Lifecycle de `Invitation` (crear/aceptar/revocar/reenviar/delivery) → `docs/features/members/spec.md`. Este slice **solo agrega el gate previo** al INSERT.
- RLS de `Invitation` / `Membership` / `PlaceOwnership` → `docs/rls/membership-invitation.md`, `docs/rls/place-access.md`. **No se toca.**
- Toggle `discoverable` y semántica del directorio → `docs/features/places/spec.md`. El área de settings lo **aloja** como otra config; este spec no lo redefine.
- Definición de grupos / tiers / permisos granulares → `docs/features/groups/spec.md`, `docs/features/tiers/spec.md`. Este slice **referencia** grupos/tiers existentes como scopes posibles; no los crea ni modifica.
- Transferir ownership / expulsar miembros → `docs/features/members/spec.md`.

## Modelo de datos PROPUESTO — sujeto a revisión

> **No es decisión cerrada.** `docs/rls/membership-invitation.md` lo deja abierto literalmente: "modelo nuevo (¿`PlaceInviteSettings`? …)". Lo de abajo es **una** propuesta para discutir con el owner, no un compromiso de schema. **No se toca `prisma/schema.prisma` hasta acordar.**

### Propuesta A (recomendada): tabla `PlaceInviteSettings` + tabla de cuotas por scope

```prisma
// PROPUESTO — sujeto a revisión. NO implementar sin acuerdo.

enum InvitePolicyMode {
  OWNER_ONLY    // solo quien tiene PlaceOwnership
  ADMINS        // owner + Membership.role = ADMIN  (a definir si este modo existe — ver "A definir")
  SCOPED        // se habilita por allowlist de grupos/tiers/users (tabla InviteQuota)
  ALL_MEMBERS   // cualquier Membership activa
}

model PlaceInviteSettings {
  placeId       String           @id
  mode          InvitePolicyMode @default(OWNER_ONLY) // default a definir con el owner
  // Cuota para el caso ALL_MEMBERS (límite por miembro). null = sin límite explícito
  // (igualmente acotado por el invariante de dominio 150).
  allMembersQuota Int?
  updatedAt     DateTime         @updatedAt
  updatedBy     String           // userId del owner que configuró (auditoría, no métrica)

  place Place @relation(fields: [placeId], references: [id])
}

// Allowlist + cuota por scope cuando mode = SCOPED.
model InviteQuota {
  id        String          @id @default(cuid())
  placeId   String
  scopeType InviteScopeType // GROUP | TIER | USER
  scopeId   String          // groupId | tierId | userId según scopeType
  quota     Int?            // máx invitaciones para este scope. null = ilimitado (acotado por 150)
  createdAt DateTime        @default(now())

  place Place @relation(fields: [placeId], references: [id])

  @@unique([placeId, scopeType, scopeId])
  @@index([placeId])
}

enum InviteScopeType { GROUP TIER USER }
```

### Contador de invitaciones usadas — derivado, NO denormalizado (propuesto)

El "cuántas invitaciones consumió un scope/actor" se **deriva por COUNT sobre `Invitation`**, no se guarda un contador mutable:

```
usadas(actor) = COUNT(Invitation WHERE placeId = :p AND invitedBy = :actorId
                       AND <estado que cuenta como consumo>)
```

Ventajas: sin estado a sincronizar, sin drift, sin contador vanidoso persistido. Costo: un `COUNT` por chequeo (índice `Invitation(placeId, invitedBy)` lo hace barato; **a definir si hace falta agregar ese índice** — `docs/features/members/spec.md` ya define `@@index([placeId])` y `@@index([email])` en `Invitation`).

> **A definir con el owner — qué cuenta como "consumo" de cuota:** ¿una invitación cuenta apenas se crea (cualquier `Invitation` con ese `invitedBy`)? ¿solo si fue aceptada (`acceptedAt != null`)? ¿se libera el cupo si la invitación expira o se revoca? Esto cambia la query de `usadas()` y la sensación de producto (cuota "de intentos" vs "de miembros traídos"). **No está en los docs fuente — decisión de producto pendiente.**

### Propuesta B (alternativa): columnas en `Place` + JSON

`Place.invitePolicyMode` (enum) + `Place.inviteQuotaConfig Json?` con la allowlist/cuotas embebida. Más simple de migrar, peor para consultar/validar y menos auditable (CLAUDE.md § límites de tamaño / auditabilidad favorece tablas explícitas sobre JSON opaco). **Se documenta como alternativa; la recomendación es Propuesta A.** Decisión final con el owner.

### Compatibilidad con la RLS ya resuelta

Ninguna de las propuestas toca la RLS de `Invitation`. La evaluación de política es **100% app-layer** (consistente con `docs/rls/membership-invitation.md`: el INSERT de `Invitation` es deny / service-role; la policy de quién-invita "no es modelable en una policy estática"). Las tablas nuevas tendrán su propia RLS cuando se diseñe (escritura owner-only / service-role, en línea con "config del place = owner-only" de `place-access.md`) — **diseño de RLS de estas tablas: a definir, fuera de este spec de comportamiento**.

## Comportamiento

### Configurar la política (área de settings general)

**Quién:** owner del place, exclusivamente. Config del place es **owner-only, no delegable** vía permisos granulares (ADR `2026-05-02`, `docs/features/places/spec.md` § "Config + archivar = owner-only", `docs/rls/place-access.md` § "Administrar"). Un ADMIN sin `PlaceOwnership` **no** puede cambiar la invite-policy.

**Dónde:** una sub-page del área de settings general del place, bajo el chrome de `docs/features/settings-shell/spec.md`. El settings-shell ya lista una section **"Acceso"** en el grupo "Place"; **a definir con el owner** si la invite-policy vive dentro de esa section "Acceso" (junto a `discoverable` / horario / acceso) o en una section propia. El path concreto (`/settings/acceso`, `/settings/general`, `/settings/invitaciones`, …) **queda a definir** — los docs fuente solo dicen "área de configuración general del place en `/settings` (a crear)".

**Qué configura el owner (acordado, `membership-invitation.md`):**

- **Modo / quién puede invitar:** solo el owner / N grupos / N tiers / N users / cualquier miembro.
- **Cuotas:** número máximo de invitaciones disponibles por grupo, por tier, por users, o para todos los miembros.

**Flow (server action de configuración, nombre propuesto `updateInvitePolicyAction`):**

1. Sesión activa; resolver `placeId`.
2. Verificar `PlaceOwnership(actor, place)` — si no, `AuthorizationError` (owner-only).
3. Place no archivado — si no, `PlaceArchivedError` (coherente con el resto de actions de members; `docs/features/members/spec.md`).
4. Validar input con Zod: `mode` ∈ enum; cuotas enteros ≥ 0 o ausentes; scopes (`groupId`/`tierId`/`userId`) existen y pertenecen al place (un grupo/tier de **otro** place no es scope válido — coherente con "identidad contextual" de CLAUDE.md).
5. Upsert de `PlaceInviteSettings` + reconciliar filas `InviteQuota` (propuesta A).
6. Log estructurado (`invitePolicyUpdated`) con `{ requestId, placeId, actorId, mode }`. **Sin contadores vanidosos en el log; sin emails.**
7. `revalidatePath` de la sub-page de settings y de la superficie de invitar.
8. Retorna `{ ok: true }`.

### Evaluar "¿este actor puede invitar y le queda cuota?" (gate server-side)

Función propuesta `assertActorCanInvite(actorId, placeId)` (app-layer, NO RLS):

1. Cargar `PlaceInviteSettings` del place. Si **no existe** fila → aplicar el **default acordado** (a definir: owner-only vs admin/owner — ver "A definir"). El sistema NUNCA falla "abierto": ante ausencia de config, el comportamiento es el más restrictivo.
2. Resolver si el actor cae en el `mode`:
   - `OWNER_ONLY` → `PlaceOwnership(actor, place)` existe.
   - `ADMINS` (si se confirma que existe) → owner **o** `Membership.role = ADMIN`.
   - `SCOPED` → el actor pertenece a algún `InviteQuota` scope habilitado: es miembro del `GROUP`, tiene el `TIER`, o es el `USER` listado.
   - `ALL_MEMBERS` → `Membership` activa del actor en el place.
   - Si no cae en ninguno → `InvitePolicyDeniedError` (AUTHORIZATION).
3. Resolver la **cuota aplicable** al actor:
   - `SCOPED`: la cuota del scope por el que califica. **A definir con el owner** la regla de desempate si el actor califica por más de un scope con cuotas distintas (ej. está en un grupo con cuota 5 y un tier con cuota 20): ¿se toma el **máximo**, el **mínimo**, o se **suman**? No está en los docs fuente.
   - `ALL_MEMBERS`: `allMembersQuota` (por miembro).
   - `OWNER_ONLY` / owner: **sin cuota** (el owner no se autolimita; siempre acotado por el invariante 150).
   - Cuota `null`/ausente → ilimitado a nivel política (igual acotado por el invariante de dominio 150).
4. Si hay cuota finita: `usadas(actor) < cuota`. Si `usadas(actor) >= cuota` → `InviteQuotaExceededError` (CONFLICT / a definir el código exacto — ver "Errores"). La definición de `usadas()` depende de "qué cuenta como consumo" (a definir, ver Modelo de datos).
5. Si pasa todo: el gate no devuelve error y `inviteMemberAction` procede.

El gate es **read-only**: no reserva ni decrementa nada (no hay contador mutable en la propuesta recomendada). El "consumo" emerge de las filas de `Invitation` que crea el flujo de `members/spec.md`.

### Integración con `inviteMemberAction` (members/spec.md)

`docs/features/members/spec.md` define hoy, en el flow de `inviteMemberAction`, el paso 3: `assertInviterHasRole(actorId, placeId)` (owner o ADMIN). Esta feature **reemplaza ese paso** por `assertActorCanInvite(actorId, placeId)`, que generaliza el chequeo a la invite-policy configurable + cuota. El resto del flow de `inviteMemberAction` (resolver place, check 150, tx corta, delivery, webhook) **no cambia**. La integración concreta (cómo se cablea sin romper los tests existentes de `invite-member.test.ts`) se coordina con el slice members al implementar — este spec define el **comportamiento esperado del gate**, no su wiring.

> El check del invariante 150 (`countActiveMemberships >= 150 → InvariantViolation`) **sigue viviendo en `inviteMemberAction`** (members/spec.md, paso 4) y es **independiente** de la invite-policy. La cuota NUNCA puede usarse para superar 150: aunque un scope tenga cuota 999, el invariante de dominio (150 miembros activos por place) corta primero. Las cuotas son un sub-límite de confianza **dentro** del invariante, jamás un override.

## Roles

| Rol                                    | En esta feature                                                                                                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| owner                                  | único que configura la invite-policy y las cuotas (owner-only, no delegable, ADR `2026-05-02`). Puede invitar siempre, sin cuota. Ve el estado de cuotas en settings (chrome admin).                                                     |
| ADMIN (sin ownership)                  | NO configura la política. Puede invitar **solo si** la política configurada lo habilita (ej. modo `ADMINS` si existe, o un scope que lo incluya). No tiene privilegio implícito de invitar por ser ADMIN, salvo que la política lo diga. |
| miembro en grupo/tier/users habilitado | puede invitar dentro de su cuota; ve su propio cupo restante (no el ajeno).                                                                                                                                                              |
| miembro sin habilitación               | no puede invitar; la UI de invitar no se le ofrece (o se le muestra deshabilitada con copy tranquilo, sin urgencia — CLAUDE.md).                                                                                                         |
| service-role                           | crea la `Invitation` tras pasar el gate (RLS de `Invitation` ya resuelta en `membership-invitation.md`).                                                                                                                                 |

## Invariantes

- **Máximo 150 miembros activos por place** es **invariante de dominio** (CLAUDE.md, `docs/features/members/spec.md`), enforced por `inviteMemberAction` + trigger DB (members 2.G). La invite-policy/cuota **nunca lo relaja ni lo supera**; opera siempre por debajo de él.
- **Config de invite-policy = owner-only, no delegable** (ADR `2026-05-02`; consistente con `Place` UPDATE = `is_place_owner` en `place-access.md`).
- **Fail-closed:** sin `PlaceInviteSettings` configurado, el place aplica el modo más restrictivo (default acordado a definir). El sistema nunca queda "abierto a invitar" por ausencia de config.
- **Sin contador de invitaciones persistido como métrica.** El consumo se deriva por `COUNT` sobre `Invitation`; no se muestra ningún total agregado vanidoso ni leaderboard (CLAUDE.md § "Sin métricas vanidosas").
- **Scopes pertenecen al place.** Un `groupId`/`tierId`/`userId` de otro place no es scope válido (identidad contextual, CLAUDE.md).
- **El gate es app-layer, no RLS.** La RLS de `Invitation` permanece exactamente como en `docs/rls/membership-invitation.md` (INSERT deny / service-role). Este spec no modifica RLS.
- **`updatedBy` es auditoría, no métrica.** Se registra quién configuró, no se expone como contador en UI de producto.

## Errores estructurados

| Error (nombre propuesto)   | Código `DomainError`                 | Cuándo                                                                                        |
| -------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `AuthorizationError`       | `AUTHORIZATION`                      | Configurar la policy sin `PlaceOwnership` (owner-only)                                        |
| `PlaceArchivedError`       | `CONFLICT`                           | Configurar / invitar contra place archivado                                                   |
| `ValidationError`          | `VALIDATION`                         | Input Zod inválido; scope (`group`/`tier`/`user`) inexistente o de otro place; cuota negativa |
| `InvitePolicyDeniedError`  | `AUTHORIZATION`                      | El actor no cae en el `mode` configurado (no está habilitado a invitar)                       |
| `InviteQuotaExceededError` | `CONFLICT` (código exacto a definir) | El actor está habilitado pero `usadas(actor) >= cuota`                                        |

Los nombres/códigos son **propuestos**, alineados al estilo de `docs/features/members/spec.md` (discriminación cliente por `code` string, sin `instanceof`; log estructurado con `requestId`; sin PII/emails crudos). El código exacto de `InviteQuotaExceededError` (`CONFLICT` vs `INVARIANT_VIOLATION`) **queda a definir** — depende de cómo se quiera que la UI lo presente vs el error de capacidad 150.

## A definir con el owner (NO inventar — no está en los docs fuente)

1. **Default cuando no hay `PlaceInviteSettings`:** ¿owner-only, o admin/owner? Los docs fuente dicen "configurable" pero no fijan el default. (El spec asume fail-closed = el más restrictivo, pero **cuál** es el más restrictivo aceptable es decisión de producto.)
2. **¿Existe el modo `ADMINS`?** `membership-invitation.md` enumera "solo el owner / N grupos / N tiers / N users / cualquier miembro". "ADMIN" no aparece explícito como bucket. Hoy `members/spec.md` da privilegio de invitar a ADMIN-o-owner; al hacer la política configurable, **hay que decidir** si "ADMIN" es un modo de primera clase o se modela como un grupo/scope.
3. **Qué cuenta como "consumo" de cuota:** invitación creada / aceptada / se libera al expirar o revocar. Cambia la query `usadas()` y la sensación de producto.
4. **Desempate de cuota multi-scope:** actor que califica por varios scopes con cuotas distintas → ¿máximo / mínimo / suma?
5. **Ubicación exacta en `/settings`:** dentro de la section "Acceso" existente del settings-shell, o section propia; path concreto.
6. **Modelo de datos final:** Propuesta A (tablas) vs B (columnas + JSON). Recomendado A; decisión del owner.
7. **Visibilidad del cupo al miembro:** ¿se le muestra "te quedan N invitaciones"? El spec lo propone (sin ser vanidoso) pero confirmar con el owner que no viola el principio "nada demanda atención".
8. **RLS de las tablas nuevas** (`PlaceInviteSettings`, `InviteQuota`): se diseña aparte (fuera de este spec de comportamiento), en línea con "config del place = owner-only / escritura service-role" de `place-access.md`.

## Fuera de scope

- Lifecycle de `Invitation` (crear/aceptar/revocar/reenviar/delivery/webhook) → `docs/features/members/spec.md`. Este slice solo agrega el gate previo.
- RLS de `Invitation`/`Membership`/`PlaceOwnership` → `docs/rls/membership-invitation.md`, `docs/rls/place-access.md`. No se toca.
- Toggle `discoverable` y directorio público → `docs/features/places/spec.md`. El área de settings lo aloja; este spec no lo redefine.
- Solicitudes de unión (`JoinRequest`) → feature aparte pendiente (`docs/rls/place-access.md` § Pendientes #3). No es invitación; no entra acá.
- Crear/editar grupos, tiers, permisos granulares → `docs/features/groups/spec.md`, `docs/features/tiers/spec.md`. Acá solo se **referencian** como scopes.
- Rediseño del chrome de `/settings/*` → `docs/features/settings-shell/spec.md`. Este slice aporta una sub-page, no rediseña el shell.
- Métricas/analytics de invitaciones (quién invitó más, conversión) → **no existe y no se construye** (CLAUDE.md § sin métricas vanidosas).

## Verificación

Cuando se implemente (TDD obligatorio — tests primero, CLAUDE.md):

1. **Unit tests** del gate `assertActorCanInvite`:
   - Sin `PlaceInviteSettings` → aplica default fail-closed (un no-owner no puede invitar).
   - `OWNER_ONLY`: owner OK; ADMIN-sin-ownership y miembro simple → `InvitePolicyDeniedError`.
   - `SCOPED` por grupo / por tier / por user: actor que califica OK; actor que no califica → denied.
   - Cuota: actor con `usadas < cuota` OK; `usadas >= cuota` → `InviteQuotaExceededError`.
   - Cuota `null`/ausente → ilimitado a nivel política pero **corta a 150** (invariante de dominio gana — test explícito de que cuota alta no supera 150).
   - Scope de otro place no habilita (identidad contextual).
2. **Unit tests** de `updateInvitePolicyAction`:
   - No-owner (incluido ADMIN sin ownership) → `AuthorizationError`.
   - Place archivado → `PlaceArchivedError`.
   - Input inválido (cuota negativa, scope inexistente, scope de otro place) → `ValidationError`.
   - Happy path: persiste `PlaceInviteSettings` + reconcilia `InviteQuota`.
3. **Integración con members:** el flujo de `inviteMemberAction` usa el gate nuevo en lugar de `assertInviterHasRole`; los escenarios de `invite-member.test.ts` (`docs/features/members/spec.md`) siguen verdes; un caso nuevo: miembro habilitado por política invita OK; miembro sin habilitación → denied antes del INSERT.
4. **E2E:** owner configura modo `SCOPED` con un grupo + cuota; un miembro de ese grupo invita hasta agotar cuota; el siguiente intento muestra el error tranquilo (sin urgencia, copy en español).
5. **Manual (cloud dev, MCP `execute_sql`):** verificar que no existe contador denormalizado y que el consumo se deriva por `COUNT` sobre `Invitation`; verificar que ninguna cuota permite superar 150 (el trigger DB de members 2.G corta).
6. **Boundary check (architecture.md):** la feature vive como slice; el gate se expone vía `public.ts`; no importa internals de otra feature; `shared/` no importa de esta feature.
