# RLS — Row Level Security de Place (modelo comprehensive)

Índice + decisiones transversales del trabajo RLS holístico. Reemplaza
el enfoque feature-by-feature (que rompía por composición — ver Decisión
1). Origen: ADR `2026-05-01-rls-comprehensive-pre-launch.md` ejecutado

- lección del intento fallido `20260515000100` (RLS de scope tables sin
  visión holística rompió las policies que las leen).

## Estado del trabajo

Features en términos de **producto** (no de tabla). Cada doc parte del
comportamiento esperado + roles y de ahí deriva la RLS de sus tablas.

| Feature (producto)                    | Doc                                                  | Tablas                                                       | Estado             |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ | ------------------ |
| Acceso al place (ver/crear/archivar)  | [place-access.md](place-access.md)                   | Place, Membership, PlaceOwnership                            | ✅ validado        |
| Membresía / invitación (unirse/salir) | [membership-invitation.md](membership-invitation.md) | Invitation (+ Membership lifecycle)                          | ✅ validado        |
| Identidad universal                   | identity.md                                          | User                                                         | pendiente          |
| Permisos / grupos                     | [groups-permissions.md](groups-permissions.md)       | GroupMembership, PermissionGroup                             | borrador (validar) |
| Tiers                                 | tiers.md                                             | Tier, TierMembership                                         | pendiente          |
| Conversaciones                        | discussions.md                                       | Post, Comment, Reaction, PostRead                            | pendiente          |
| Eventos                               | events.md                                            | Event, EventRSVP                                             | pendiente          |
| Reportes                              | flags.md                                             | Flag                                                         | pendiente          |
| Biblioteca                            | library.md                                           | LibraryCategory, LibraryItem, \*Scope, LibraryItemCompletion | pendiente          |
| Horario                               | hours.md                                             | PlaceOpening                                                 | pendiente          |
| Erasure / infra                       | erasure-infra.md                                     | ErasureAuditLog, DiagnosticLog                               | pendiente          |

28 tablas en `public` (excl. `_prisma_migrations`). 17 con RLS hoy
(varias con policies a re-auditar), 11 sin.

## Decisiones transversales (fijadas)

### D1 — Helpers de RLS = `SECURITY DEFINER` (obligatorio)

**El error raíz del enfoque viejo.** Las funciones que evalúan acceso
(`is_active_member`, `is_place_admin`, `is_place_owner`,
`is_in_category_read_scope`, futuras) **leen tablas que también tendrán
RLS** (`Membership`, `PlaceOwnership`, `GroupMembership`, scope tables…).

- `SECURITY INVOKER` (lo que hay hoy): la función corre con el rol del
  caller. Cuando la tabla leída tiene RLS y el caller es un member
  común, la función no puede leerla → devuelve `false` → la policy que
  la usa niega acceso a quien sí lo tiene. **Esto rompió
  `20260515000100`.** Hoy `is_active_member`/`is_place_admin` funcionan
  solo porque `Membership`/`GroupMembership`/`PlaceOwnership` aún no
  tienen RLS — es una bomba de tiempo.
- `SECURITY DEFINER` + `SET search_path = public`: la función corre con
  los privilegios del owner (postgres), bypaseando la RLS de las tablas
  que lee, de forma **controlada y auditada** (la función encapsula la
  regla; no expone las tablas). Patrón canónico Postgres para "security
  barrier functions".

**Regla**: toda función-helper consumida por una `USING`/`WITH CHECK`
es `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, con
`GRANT EXECUTE ... TO authenticated, anon`. Las 3 existentes
(`is_active_member`, `is_place_admin`, `is_place_owner`) se migran a
DEFINER en Fase 2 (hoy son INVOKER).

### D2 — Orden de dependencia

Las policies de contenido dependen de helpers que leen tablas base.
Construir/aplicar en este orden:

1. **identity/access** (`User`, `Membership`, `PlaceOwnership`, `Place`,
   `Invitation`) + migrar los 3 helpers a DEFINER.
2. **groups/permisos** (`GroupMembership`, `PermissionGroup`) + tiers
   (`Tier`, `TierMembership`) — los lee `is_place_admin` / scope tiers.
3. **contenido**: discussions, events, flags, library, hours.
4. **erasure/infra**: `ErasureAuditLog` (ya deny-all), `DiagnosticLog`.

### D3 — Switch runtime (Fase 3, único, holístico)

Hoy Prisma usa service-role (`DATABASE_URL`) que **bypassa RLS** — todas
las policies están escritas pero **dormidas**. El switch: wrapper que en
cada request/tx ejecuta `SET LOCAL ROLE authenticated` +
`SET LOCAL request.jwt.claims = '{"sub":<userId>,...}'` antes de las
queries (mismo patrón que `tests/rls/harness.ts`). Se activa **una vez,
al final**, con todas las policies puestas y auditadas. Hasta entonces
la defensa efectiva es app-layer (filtros explícitos por `placeId` +
gates como `assert-readable.ts`).

### D4 — Naming + deny-by-default

- Policy name: `"<Tabla>_<op>_<criterio>"` (ej.
  `"Membership_select_self_or_admin"`).
- RLS habilitado **sin policy** = deny total para `authenticated`. Las
  tablas de configuración/escritura server-side (gestionadas vía
  service-role) **no llevan policy** de INSERT/UPDATE/DELETE → la app
  (service-role) las maneja, el cliente no puede tocarlas. Precedente:
  `ErasureAuditLog` (RLS on, 0 policies).

### D5 — owner/admin no es bypass del motor

El acceso de owner/admin se **expresa en las policies** vía
`is_place_owner` / `is_place_admin`, no saltando RLS. service-role (la
app server-side) sí bypassa por diseño hasta el switch; eso no es una
policy, es la naturaleza del rol de conexión.

### D6 — Cada doc de feature

Por cada tabla de la feature: matriz `SELECT | INSERT | UPDATE |
DELETE`, helper(s) que usa, quién puede, y notas de composición
(qué otras policies la leen → impacto DEFINER).
