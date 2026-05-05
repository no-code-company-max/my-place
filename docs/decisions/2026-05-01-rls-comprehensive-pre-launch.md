# RLS comprehensive pre-launch (no feature-by-feature)

**Fecha:** 2026-05-01
**Estado:** Aceptada
**Origen:** B1 (RLS faltante en tablas de control de acceso) + m4 (tests RLS faltantes) + parte de m5 del audit checklist 2026-05-01.

## Contexto

El audit checklist identificó 3 gaps relacionados con Row-Level Security:

- **B1**: 4 tablas core sin RLS habilitado: `Membership`, `PlaceOwnership`, `Place`, `Invitation` (+ `User`).
- **m4**: 2 tests RLS faltantes: `EventRSVP` y `LibraryCategoryContributor` (las policies SQL existen, los tests no).
- **m5**: necesidad de ADR para excepciones intencionales.

## Estado actual verificado (2026-05-01)

**12 tablas con RLS habilitado + policies**:

| Tabla                        | Policies            | Test RLS                      |
| ---------------------------- | ------------------- | ----------------------------- |
| `Post`                       | 4                   | ✅ `post.test.ts`             |
| `Comment`                    | 3                   | ✅ `comment.test.ts`          |
| `Event`                      | 3                   | ✅ `event.test.ts`            |
| `EventRSVP`                  | 4                   | ❌ falta                      |
| `Flag`                       | 3                   | ✅ `flag.test.ts`             |
| `LibraryCategory`            | 3                   | ✅ `library-category.test.ts` |
| `LibraryCategoryContributor` | 3                   | ❌ falta                      |
| `LibraryItem`                | 3                   | ✅ `library-item.test.ts`     |
| `PlaceOpening`               | 1                   | ✅ `place-opening.test.ts`    |
| `PostRead`                   | 2                   | ✅ `post-read.test.ts`        |
| `Reaction`                   | 3                   | ✅ `reaction.test.ts`         |
| `ErasureAuditLog`            | 0 (deny by default) | — (service-role only)         |

**5 tablas SIN RLS**: `Membership`, `PlaceOwnership`, `Place`, `Invitation`, `User`. Son las tablas de **control de acceso** (quién es miembro de qué place, quién es owner, qué places existen, invitaciones pendientes, identidad universal del user).

## Riesgo identificado por el audit (B1)

Sin RLS en `Membership` / `PlaceOwnership`, una query autenticada que omitiera filtrar por `placeId` podría leer membership/ownership de **cualquier place**, no solo del lookup que está haciendo el actor. Riesgo: leak cross-tenant si un endpoint nuevo introduce queries sin filtros explícitos.

Hoy el código mitiga esto siempre filtrando explícitamente:

- `findActiveMembership(userId, placeId)` siempre pasa ambos.
- `findPlaceOwnership(userId, placeId)` idem.
- `loadPlaceBySlug(slug)` filtra por slug único.
- Las queries nunca hacen `prisma.membership.findMany()` sin `where`.

Es **defense-in-depth opcional** — la RLS sería el cinturón sobre la silla, mientras la app tiene los tirantes. Pero sin tests RLS no podemos garantizar que el cinturón esté ahí.

## Decisión

**Implementar RLS comprehensive en una sola pasada al final del MVP, antes del launch a producción con users reales.** NO atacar B1 + m4 incrementalmente.

Esto cubre:

- Habilitar RLS + escribir policies en las 5 tablas faltantes (`Membership`, `PlaceOwnership`, `Place`, `Invitation`, `User`).
- Escribir los 2 tests RLS faltantes (`EventRSVP`, `LibraryCategoryContributor`).
- Re-auditar las 12 policies existentes para detectar drift entre policies actuales y comportamiento esperado post-MVP completo.
- Cobertura E2E del comportamiento RLS bajo escenarios cross-tenant.

## Razones

1. **RLS feature-by-feature genera churn**. Cada feature nueva agrega tablas o cambia relaciones. Implementar policies hoy obliga a revisarlas + actualizar tests cada vez que aparece un nuevo slice. Ejemplo concreto: la migration de erasure 365d (2026-05-01) cambió `Flag.reporterUserId` a nullable y reescribió la FK — eso forzó a re-validar la policy `Flag_select_admin_or_reporter` (lo hicimos, pero es overhead).

2. **Visión holística al final captura interacciones**. Las policies de `Membership` interactúan con las de `Place`, `PlaceOwnership`, e indirectamente con todas las del contenido (Post/Comment/Event/Library) que joinean contra `Membership` para chequear "actor es miembro activo". Diseñar las 5 policies faltantes en aislamiento puede generar bugs de composición que un audit holístico atrapa.

3. **El código de app no depende de RLS para correctness**. Todas las queries filtran explícitamente por `placeId`. La RLS es **defense-in-depth**, no la primera línea. Mientras estamos en MVP con un set de devs chico haciendo PR review, la primera línea es suficiente.

4. **El blast radius pre-launch es bajo**. Sin users reales, un eventual leak es cosmético: el dev que lo descubre lo reporta. Post-launch, el blast radius sube — por eso el comprehensive ANTES del launch.

5. **Testing RLS requiere infra cerrada (harness)**. El harness `tests/rls/harness.ts` ya está. Pero implementar tests para 5 tablas nuevas + 2 faltantes en el comprehensive permite un sweep coherente (no incremental).

## Cuándo ejecutar el comprehensive

Hito de disparador: **antes del primer deploy a producción con un place real (no de test) con miembros que no sean parte del equipo de desarrollo**. Ese es el cutover de "MVP cerrado" → "launch".

Sub-tareas que componen el comprehensive (estimación 1-2 sesiones):

1. Migration `*_access_tables_rls/migration.sql`:
   - `Membership`: SELECT propio + miembros del mismo place; INSERT/UPDATE solo via service-role (no client direct).
   - `PlaceOwnership`: SELECT del propio + de places donde es admin; UPDATE solo service-role.
   - `Place`: SELECT abierto a miembros activos (`EXISTS Membership`); UPDATE solo admin/owner via service-role check.
   - `Invitation`: SELECT del invitado o de admins; INSERT admin only via service-role.
   - `User`: SELECT del propio + de users que comparten un place activo (necesario para member-list); UPDATE solo del propio.
2. Tests `tests/rls/{membership,place-ownership,place,invitation,user,event-rsvp,library-category-contributor}.test.ts` — 7 archivos siguiendo el patrón del harness existente.
3. Re-audit de las 12 policies actuales para detectar drift acumulado.
4. ADR específica del `*_access_tables_rls` con shape final de cada policy (este ADR es la decisión de **diferimiento**; el ADR del comprehensive documenta el **diseño**).
5. E2E smoke: un spec que valide cross-tenant isolation a nivel UI (member del place A no ve nada del place B aún si conoce IDs).

## Implicancias durante MVP (hasta el comprehensive)

- **No agregar features que dependan de RLS para correctness**. Si se introduce un endpoint nuevo, el code review verifica que filtra explícitamente por `placeId` (defense-in-depth basal).
- **Documentar policies nuevas que sí escribamos** (ej: si Fase 7 agrega chat directo, su tabla DM necesita policies desde el día uno; aplica el comprehensive principle a esa tabla individualmente).
- **No promover deploys a "producción con users reales"** sin haber ejecutado el comprehensive primero. Esta ADR es el gate.
- **B1, m4, m5 quedan registrados como "diferidos vía ADR"** en el audit checklist — no son deuda activa, son trabajo programado pre-launch.

## Riesgos aceptados

- **Bug de leak cross-tenant durante desarrollo MVP**: bajo (pocas personas con DB access, filtros explícitos en código). Si ocurre, el code review lo atrapa antes del merge.
- **Complejidad acumulada al hacer el comprehensive**: medio. Cuantas más tablas + relaciones, más lógica para componer policies. Mitigación: el ADR del comprehensive incluirá un mapa de joins inter-tabla antes de escribir SQL.
- **Olvido del trigger pre-launch**: bajo. Esta ADR es el doc de referencia; el checklist apunta a ella; la roadmap también la mencionará.

## No aplica

Esta ADR **no** autoriza:

- Operar en producción con users reales sin RLS comprehensive.
- Eliminar las policies actuales (las 12 ya escritas siguen vigentes — solo se re-auditan, no se rebajan).
- Escribir endpoints que confíen en RLS sin filtro explícito en code path. Defense-in-depth significa **ambas** capas.
- Postergar indefinidamente: el cutover MVP → launch dispara el comprehensive obligatoriamente.

## Referencias

- `prisma/migrations/20260422000100_discussions_rls/migration.sql` — primer migration RLS (Post, Comment, Reaction, Flag).
- `tests/rls/harness.ts` — infra de testing RLS bajo `DIRECT_URL` session mode.
- `docs/decisions/2026-04-22-e2e-rls-testing-cloud-branches.md` — ADR de testing infra RLS.
- `docs/plans/2026-05-01-audit-checklist.md` § B1, m4, m5.
- `CLAUDE.md` § Gotchas — RLS harness + private channels Realtime.
