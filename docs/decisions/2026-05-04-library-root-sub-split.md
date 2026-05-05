# ADR — Sub-split de `library/` raíz + CI cap enforcement project-wide

**Fecha:** 2026-05-04
**Estado:** Aceptado
**Plan dedicado:** `docs/plans/2026-05-04-library-root-sub-split-and-cap-enforcement.md`
**Plan padre (cierre G.1):** `docs/plans/2026-05-04-library-courses-and-read-access.md`

## Contexto

El cap de **1500 LOC por feature/slice** está declarado en `CLAUDE.md` y `docs/architecture.md`. Su función no es estética: es **operativa**. Slices que exceden el cap fragmentan el contexto del agente (Claude) al razonar sobre el código, lo que encarece progresivamente cada feature futura sobre ese slice.

Al cerrar el plan G.1 (library courses + read access) detectamos que `library/` raíz acumuló **6700 LOC prod + 4400 LOC tests** en R.7 + G.x sin que nadie pausara. Audit posterior reveló que el problema no es exclusivo de library: **8 slices superan el cap hoy**, ninguno con CI enforcement, sólo 1 con ADR explícito (`discussions`, ya escrito en abril 2026).

## Causa raíz del crecimiento sin governance

1. **El cap es doc, no CI.** `CLAUDE.md` y `architecture.md` lo declaran; no hay hook que lo enforce. La auto-verificación post-fase reportaba LOC pero nadie comparaba contra cap entre commits.
2. **Precedente confuso.** El ADR de discussions (`2026-04-20-discussions-size-exception.md`) se interpretó como "discussions es especial", no como "todo slice denso requiere ADR pre-crecimiento". Cuando library, members, groups, etc. cruzaron 1500, nadie escribió ADR — el patrón de governance no se replicó.
3. **Sesiones cortas no re-leen el cap.** Una fase de 6 horas con 9 commits consecutivos no tiene checkpoint manual. El punto de "cruzó 1500" pasó entre sesiones sin alertas.

## Decisión

### A. Sub-splittear `library/` raíz en 3 sub-slices nuevos

Patrón ya validado por `library/access/` + `library/courses/` (ADR `2026-05-04-library-courses-and-read-access.md`). Extracción secuencial por coupling creciente:

| Sub-slice                  | LOC esperado | Contenido                                                                                          |
| -------------------------- | ------------ | -------------------------------------------------------------------------------------------------- |
| `library/embeds/`          | ~590         | TipTap embed extension + node-view + parser + toolbar                                              |
| `library/items/`           | ~875         | UI + actions de items (form, editor, header, admin-menu, ItemList wrapper, EmptyItemList)          |
| `library/admin/`           | ~1610        | UI admin de categorías + actions de category (CRUD + contributors + scopes)                        |
| `library/` raíz post-split | ~1100        | domain/, schemas, server queries + viewer, UI presentational shared, `LibraryItemRow`, `errors.ts` |

`LibraryItemRow` y `friendlyLibraryErrorMessage` quedan en raíz por ser shared cross-sub-slice (`RecentsList` raíz + `ItemList` items/ usan el primero; items/ + admin/ usan el segundo).

### B. CI cap enforcement project-wide

Script `scripts/lint/check-slice-size.ts`:

- Itera `src/features/<slice>/` (top-level) + sub-slices (carpetas con `public.ts` propio).
- Cuenta LOC `.ts` + `.tsx` excluyendo `__tests__/` + `*.test.{ts,tsx}`.
- Compara contra cap default 1500 LOC o entry de WHITELIST.
- Falla con exit code 1 si algún slice/sub-slice supera su cap declarado.
- Invocado desde `pnpm lint` (compone con eslint, sin paso adicional).

WHITELIST hardcoded en el script — auditable por diff. Cada entry requiere `adrPath` vinculante. Entries marcadas `temporary: true` requieren además `planPath` apuntando al plan que las cierra.

### C. Plan project-wide para devolver TODOS los slices a ≤1500 LOC

Decisión del owner (2026-05-04 sesión): **rechazar la opción de "ADR de excepción permanente"** como solución default. El cap existe por una razón operativa concreta (manejabilidad por agente). ADR de excepción se reserva sólo para casos donde el split es genuinamente artificial.

Slices afectados + plan dedicado:

| Slice          | LOC actual | Estrategia                                                                  | Plan                                                              |
| -------------- | ---------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `discussions`  | 7362       | Sub-split en 5 sub-slices (rich-text, reactions, presence, posts, comments) | `2026-05-04-discussions-sub-split.md`                             |
| `library` raíz | 6666       | Sub-split en 3 (embeds, items, admin)                                       | `2026-05-04-library-root-sub-split-and-cap-enforcement.md` (este) |
| `members`      | 4490       | Sub-split en 5 (invitations, moderation, directory, profile, erasure)       | `2026-05-04-members-sub-split.md`                                 |
| `groups`       | 2969       | Sub-split en 4 (admin, crud, memberships, category-scope)                   | `2026-05-04-groups-sub-split.md`                                  |
| `events`       | 2532       | Sub-split en 3 (rsvp, calendar, editor)                                     | `2026-05-04-events-sub-split.md`                                  |
| `hours`        | 2251       | Sub-split en 2 (admin, member)                                              | `2026-05-04-hours-sub-split.md`                                   |
| `flags`        | 1643       | Trim de comments + posible mini-split (create-flow, review-queue)           | `2026-05-04-flags-trim-and-split.md`                              |
| `tiers`        | 1608       | Trim + posible split de UI                                                  | `2026-05-04-tiers-trim-or-split.md`                               |

Orden de ejecución (por ROI + dependencias): library → discussions → members → groups → events → hours → flags → tiers.

WHITELIST temporal incluye los 8 slices durante la transición. A medida que cada plan cierra, su entry se elimina. El cap default 1500 sigue vigente para slices nuevos desde el día 1.

## Alternativas descartadas

1. **ADR de excepción permanente para library raíz.** Patch sobre el síntoma; institucionaliza el patrón "ignorar el cap cuando crecemos". Rechazado.
2. **Sub-split solo de library, dejar otros slices con ADR ad-hoc.** Resuelve un caso, deja 6 más. La gobernanza queda inconsistente. Rechazado.
3. **Subir el cap default a 3000 LOC.** Cambia el techo para hacer caber el problema actual. No resuelve la causa raíz (manejabilidad por agente) y vuelve a aceptar slices grandes mañana. Rechazado.
4. **Refactor solo de comments/docstrings sin reorganizar archivos.** Funciona para slices marginales (flags, tiers) pero no para library/discussions/members donde el problema es estructural. Aplica como herramienta complementaria, no como solución única.
5. **Promover sub-features a top-level slices.** Considerada para casos donde el sub-dominio es genuinamente ortogonal (como pasó con `tier-memberships/`). Se mantiene como herramienta caso-por-caso pero no es la regla.

## Consecuencias

**Positivas**:

- Codebase navegable indefinidamente por agentes sin fragmentar contexto.
- Boundary tests + CI cap atrapan regresiones automáticamente.
- Sub-slices fuerzan arquitectura cohesiva (cada sub-dominio con su stack vertical completa).
- Patrón consistente y auditable.

**Negativas / costos asumidos**:

- ~30-35 sesiones de trabajo distribuidas en 8 planes para pagar la deuda histórica.
- Pages que mezclan sub-slices terminan con 4-5 import statements (mitigable con convención de orden).
- Imports cross-sub-slice obligan a re-export via `public(.server).ts` — friction inicial.
- Velocidad de feature delivery temporalmente afectada hasta cerrar el backlog.

## Verificación

- ✅ Plan G.1 cerrado.
- ✅ Plan dedicado de library raíz redactado.
- ✅ Script CI funcional (`pnpm tsx scripts/lint/check-slice-size.ts`).
- ✅ WHITELIST inicial documentada con 8 entries temporales.
- ⏳ S.0 cierra cuando: ADR + boundary test + script integrado a `pnpm lint` + CLAUDE.md gotcha + 7 plan placeholders escritos. Lint general queda verde con whitelist temporal.
- ⏳ Métricas finales se actualizan en S.5 del plan de library.
- ⏳ Cada uno de los 7 planes restantes pasa por su propio S.0/.../S.N → eliminar entry de WHITELIST al cerrar.

## Referencias

- `CLAUDE.md` § Límites de tamaño.
- `docs/architecture.md` § Límites de tamaño + § Reglas de aislamiento.
- `docs/decisions/2026-04-20-discussions-size-exception.md` (precedente histórico — superseded por sub-split).
- `docs/decisions/2026-05-04-library-courses-and-read-access.md` (patrón sub-slice validado).
