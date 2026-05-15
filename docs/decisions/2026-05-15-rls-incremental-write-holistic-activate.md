# RLS: policies escritas incrementalmente, activación runtime holística

**Fecha:** 2026-05-15
**Estado:** Aceptada
**Supersede parcialmente:** `2026-05-01-rls-comprehensive-pre-launch.md`
(ajusta su regla "no incremental" — ver Contexto).
**Origen:** Plan A `docs/plans/2026-05-15-library-read-access-enforcement.md`
(Hallazgo #2) + audit de vigencia de ADRs RLS/permisos/library.

## Contexto

Durante el cierre del Hallazgo #2 (read-access de biblioteca sin
enforcement) se descubrieron dos hechos:

1. **Prisma bypassa RLS en runtime.** `src/db/client.ts` conecta vía
   `DATABASE_URL` con `@prisma/adapter-pg` usando un rol fijo, sin setear
   `auth.uid()` / `request.jwt.claims`. Las 12 tablas con policies RLS
   escritas están **dormidas en runtime**: publicar/editar/leer en
   threads, biblioteca, eventos, settings — todo pasa sin RLS efectivo
   por-usuario. No es un error sin consenso: es el diferimiento
   deliberado del ADR `2026-05-01`.

2. **Contradicción activa.** Los ADR `2026-05-04-library-courses-and-read-access`
   y `2026-05-12-library-permissions-model` especifican RLS SELECT por
   `readAccessKind` con un helper `is_in_category_read_scope`. Solo se
   implementó el lado **write** (INSERT, migración `20260513000000`). La
   policy SELECT (`LibraryItem_select_member_or_admin`, migración
   `20260430010000`) nunca se actualizó. Quien lee el ADR `2026-05-12`
   asume que la RLS read existe — no existía.

El ADR `2026-05-01` decidió "RLS comprehensive en una pasada, NO
incremental" con un motivo concreto: _cada feature nueva cambia tablas →
churn de mantener policies + tests_. Ese supuesto asumía features en
flujo temprano. El contexto cambió: el modelo de datos de library/
permisos está consolidado (no se crean tablas nuevas; se vienen cerrando
features y limpiando duplicados). El miedo al churn ya no aplica con la
misma fuerza para estas áreas estabilizadas.

## Decisión

Separar dos cosas que el ADR `2026-05-01` trataba como una:

1. **Escribir + testear policies RLS** puede hacerse **incrementalmente
   AHORA**, por área, cuando esa área está consolidada. Escribir una
   policy + probarla en el harness aislado (sin activarla en runtime) NO
   genera el churn que `2026-05-01` temía — las features ya no cambian.

2. **Activar el enforcement en runtime** (el wrapper Prisma que inyecta
   `request.jwt.claims` por request, despertando TODAS las policies de
   golpe) sigue siendo un **paso único, holístico, pre-launch**, con
   re-audit de todas las policies juntas. Esto NO cambia respecto de
   `2026-05-01`: el switch global es naturalmente todo-o-nada y requiere
   visión holística (encenderlo con una policy bugueada rompe features).

Es decir: `2026-05-01` prohibía implementar **+ activar** incremental;
este ADR permite **escribir + testear** incremental, manteniendo la
**activación** holística. No es una contradicción del anterior — es una
precisión que su redacción no distinguía.

## Aplicación inmediata (Plan A S4)

Migración `20260515000000_library_read_scope_rls`:

- Helper `is_in_category_read_scope(category_id)` — `SECURITY INVOKER`,
  `STABLE`, `search_path=public` (mismo contrato que `is_place_admin`/
  `is_place_owner`). Replica `canReadCategory || canWriteCategory` (write
  implica read — decisión B Plan A: un contributor fuera del read-scope
  no pierde lectura de la categoría donde escribe). Mismo patrón SQL
  exacto que `LibraryItem_insert_with_write_access`.
- Reescribe la policy SELECT sumando el gate, preservando: blind-write
  protection del author, audit/restore del admin.

**Esta migración cierra la contradicción activa**: el ADR `2026-05-12`
ya no miente — la RLS read existe como artefacto.

## Decisiones puntuales

- **App-layer es la puerta efectiva en MVP.** Plan A S1-S3
  (`assert-readable.ts` + enforcement en pages/actions) es lo que
  realmente protege hoy, porque Prisma+service-role bypassa RLS. La RLS
  es **backstop**: acceso directo a la DB, clientes RLS-aware futuros,
  bugs futuros del app-layer.
- **Asimetría admin (consciente).** `canReadCategory` (app-layer) niega
  admin-no-owner en categorías restringidas (decisión ADR `2026-05-04`).
  La policy RLS conserva acceso admin para no romper audit/restore de
  archivados. Aceptable: RLS es backstop (no la puerta efectiva) y un
  admin con DB access es confianza alta. Si en el switch holístico se
  decide endurecer, se revisa ahí.
- **La migración NO se aplica como parte de este ADR.** Aplicar a cloud
  (`prisma migrate deploy` / Supabase MCP) + correr `pnpm test:rls` es
  un paso de deploy con blast radius — requiere decisión explícita y
  está bloqueado por la deuda del harness (ver Follow-ups).

## Follow-ups registrados (no se pierden)

1. **Switch runtime holístico pre-launch** — sigue siendo el
   comprehensive de `2026-05-01` para las 5 tablas de control de acceso
   (Membership/PlaceOwnership/Place/Invitation/User) + el wrapper Prisma
   que inyecta el claim + re-audit de las 12+ policies juntas. Gate:
   antes del primer place real con miembros externos al equipo.
2. **Harness RLS de library desincronizado** — `tests/rls/harness.ts`
   `insertTestLibraryCategory` inserta `contributionPolicy::"ContributionPolicy"`
   y `insertTestLibraryContributor` usa `LibraryCategoryContributor`:
   ambos DROPEADOS en `20260513000000`. El test RLS de read-scope (y
   probablemente `library-item.test.ts` actual) no corre hasta reparar
   el harness (quitar contributionPolicy, sumar readAccessKind/
   writeAccessKind + helper `insertTestLibraryReadScope`). Deuda
   preexistente descubierta — bloquea la verificación del test RLS S4.
3. **Punto 7 (`findLibraryItemForMention`)** — resolver de menciones
   cross-slice que renderiza título+link de item restringido embebido
   en threads. Gatearlo exige propagar el viewer por
   `buildMentionResolvers` (usado en todo render de discussions).
   Severidad baja (un título). Diagnóstico en el plan; refactor propio.
4. **ADRs APLICADO-Y-CERRADO a marcar históricos** (del audit, para no
   confundir): `2026-05-03-drop-membership-role-rls-impact` (su sección
   "Verificación pendiente" está obsoleta), `2026-05-09-g3-edit-as-delegable-permission`
   (dice "12 permisos"; hoy hay 13), `2026-05-09-discussions-subslice-experiment-closed`.
   Y `2026-05-04-library-contribution-policy-groups` supersedido por
   `2026-05-12` sin marca visible.

## Auditoría de datos (corrida 2026-05-15)

`LibraryCategory WHERE readAccessKind != 'PUBLIC'` en toda la BD: **1
sola fila** (`no-code-bubble`, place de testing del owner, TIERS con 1
tier asignado, bien configurada). Sin categorías "rotas" (no-PUBLIC con
pivotes vacíos). Activar el enforcement app-layer (ya hecho S1-S3) tiene
blast radius mínimo. Sin backfill necesario (default `PUBLIC` seguro).

## No aplica

- No autoriza operar en producción con users reales sin el switch
  runtime holístico (sigue vigente el gate de `2026-05-01`).
- No activa RLS en runtime (Prisma sigue service-role).
- No rebaja ninguna policy existente.

## Referencias

- Plan: `docs/plans/2026-05-15-library-read-access-enforcement.md`
- Supersede parcialmente: `docs/decisions/2026-05-01-rls-comprehensive-pre-launch.md`
- Reconcilia: `docs/decisions/2026-05-12-library-permissions-model.md` §RLS
- Migración: `prisma/migrations/20260515000000_library_read_scope_rls/`
- Patrón espejado: `prisma/migrations/20260513000000_library_drop_legacy_contribution/`
