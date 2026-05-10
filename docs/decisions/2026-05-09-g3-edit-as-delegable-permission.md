# Override de ADR §2: editar contenido ajeno SÍ es permiso atómico delegable

**Fecha:** 2026-05-09
**Estado:** Aceptada
**Origen:** Decisión del owner durante el plan G.3 port (`docs/plans/2026-05-09-g3-debt-port-to-legacy.md`). Override explícito de la decisión §2 del ADR `2026-05-02-permission-groups-model.md`.

## Contexto

ADR `2026-05-02-permission-groups-model.md` § 2 estableció:

> "Editar contenido ajeno NO es permiso atómico delegable. Solo el owner del place puede bypass del 60s window."

Esa decisión se basó en la simetría con el rol legacy `ADMIN` (un admin podía editar ajenos por privilegio, no por delegación). Al diseñar G.3, se asumió que la moderación de edits era un caso fuerte que merecía bypass solo del owner.

Durante el plan G.3 port (cierre de la deuda silenciosa donde el legacy raíz no honraba la delegación atómica via custom groups), el owner re-evaluó esa decisión. Caso de uso identificado: places editoriales o productivos donde un grupo "Revisores" delegado podría querer corregir typos o pulir posts ajenos sin tener owner del place.

La decisión también aplica por simetría a library items (`library:edit-item`), que tenía el mismo gate `viewer.isAdmin` en `library/items/server/actions/update-item.ts:65`.

## Decisión

Sumar 2 nuevos permisos atómicos delegables al enum `PERMISSIONS_ALL` en `src/features/groups/domain/permissions.ts`:

1. **`discussions:edit-post`** — habilita bypass del 60s edit window para posts ajenos. Aplicado en `discussions/server/actions/posts/edit.ts` (función `editPostAction` y `openPostEditSession`).
2. **`library:edit-item`** — habilita edit de items ajenos en biblioteca. Aplicado en `library/items/server/actions/update-item.ts` (función `updateLibraryItemAction`).

Owner sigue con bypass automático (siempre puede editar ajenos). Member del preset group "Administradores" sigue pudiendo editar ajenos (preset incluye TODOS los permisos por defecto, incluyendo estos 2 nuevos). Member de un grupo custom con uno de estos 2 permisos delegados también puede ahora editar ajenos en su dominio.

El total de permisos atómicos sube de **10 a 12**.

## Alternativas consideradas

### A. Mantener ADR §2 estricto (descartada)

Sostener que editar ajenos NO es delegable. El plan G.3 port iba a usar `findPlaceOwnership` directo (owner-only bypass) para `edit.ts` y `update-item.ts`, eliminando el bypass del preset group también.

- **Pros**: simplicidad arquitectónica; menos permisos en la lista (10 en lugar de 12); alineación estricta con ADR §2.
- **Cons**: incoherente — si delegamos `delete-post`/`hide-post` (acciones de mayor poder destructivo), no tiene sentido bloquear `edit-post` (acción más recoverable). Cambio semántico para users actuales del preset group, que pierden capacidad de edit ajenos.

### B. Convertir a permiso delegable (elegida)

Los 2 nuevos permisos.

- **Pros**: coherencia con el modelo G.3 (todo lo que es moderación es delegable); permite use cases editoriales reales; preserva comportamiento del preset group.
- **Cons**: 2 permisos más en el enum (12 total); override formal de ADR §2 (este doc).

### C. Híbrido — solo discussions, no library (descartada)

Solo agregar `discussions:edit-post`, dejar library con `viewer.isAdmin`.

- **Pros**: scope más acotado.
- **Cons**: inconsistencia entre discussions y library sin razón clara. La simetría es preferible.

## Consecuencias

### Cambios necesarios en código (parte del plan G.3 port Approach C)

1. `src/features/groups/domain/permissions.ts`: enum + label updates ✓ (commit junto con este ADR).
2. `src/features/discussions/server/actions/posts/edit.ts`: cambiar `if (!actor.isAdmin)` por `if (!isOwner && !await hasPermission(..., 'discussions:edit-post'))`. Aplica a `editPostAction` y `openPostEditSession` (ambos checkean adminBypass).
3. `src/features/library/items/server/actions/update-item.ts`: cambiar `canEditItem(...viewer)` para que `viewer.isAdmin` se reemplace por `isOwner || await hasPermission(..., 'library:edit-item')`.
4. UI de groups (`src/app/[placeSlug]/settings/groups/...`): si tiene checkbox list de permisos hardcoded, agregar 2 entradas. Si renderiza `PERMISSIONS_ALL` directo, no hay cambio (auto-discovery).
5. Tests legacy: actualizar mocks de `groupMembership.findMany` para incluir el nuevo permiso en los grupos custom de prueba.

### Cambios en producción

- **Owners actuales**: sin cambios visibles. Siguen pudiendo editar ajenos.
- **Members del preset group "Administradores"**: sin cambios visibles. El preset por defecto incluye TODOS los permisos, incluyendo los 2 nuevos. Siguen pudiendo editar ajenos.
- **Owners que crean nuevos grupos custom**: ahora ven 2 checkboxes adicionales (`Editar discusiones ajenas (post-60s)` y `Editar recursos ajenos en biblioteca`). Pueden delegar editorial moderation a un grupo si quieren.
- **Members de custom groups creados antes de este cambio**: sin cambios. Sus grupos no incluyen los 2 nuevos permisos (los grupos se crearon cuando los permisos no existían). Si el owner quiere delegarles edit, edita el grupo y marca los nuevos checkboxes.

### Breaking change para grupos existentes — NO hay

El change es additive. Grupos existentes quedan intactos: sus arrays `permissions: text[]` no incluyen los 2 nuevos, y la query `hasPermission(..., 'discussions:edit-post')` retorna `false` para ellos. Hasta que el owner explícitamente los agregue, comportamiento preservado.

### Migration de DB — NO requerida

`PermissionGroup.permissions` es `text[]` (array de strings). El enum vive en código, no en DB. Sumar valores al enum no requiere migration. Validación Zod en el server action `createGroup`/`updateGroup` ya rechaza permisos no listados — la actualización del enum acepta los nuevos automáticamente.

### Override de ADR §2

Este ADR override la sección §2 del ADR `2026-05-02-permission-groups-model.md`. La sección §2 sigue siendo válida para los OTROS items que enumera como owner-only:

- Expulsar miembros (`expelMemberAction`).
- Transferir ownership.
- CRUD de tiers + asignación de tiers.
- CRUD de grupos + asignación/remoción de miembros a grupos.
- Settings del place (theme, hours, billing, opening).
- Archivar el place.

Solo los 2 ítems de "edit content ajeno" cambian. ADR §2 NO es revertido entero — solo los 2 ítems mencionados.

## Verificación

- `pnpm typecheck`: verde post-cambio del enum (tipo `Permission` se infiere automático desde `PERMISSIONS_ALL`).
- `pnpm test`: verde post-cambio (1973/1973 — sin breaks por adición de strings al enum).
- Smoke check del plan G.3 port (sección 4) cubre: user con custom group + `discussions:edit-post` puede editar post ajeno; user sin el permiso recibe 403.

## Referencias

- ADR original `docs/decisions/2026-05-02-permission-groups-model.md` § 2 (decisión revertida parcialmente acá).
- Plan G.3 port `docs/plans/2026-05-09-g3-debt-port-to-legacy.md` — aplica este permiso en sub-fases A4 (discussions) y A3.5 (library item).
- Análisis B.4/B.5 `docs/plans/2026-05-09-posts-comments-analysis.md` — descubrió la deuda G.3 silenciosa que motivó la re-evaluación.
- Spec del feature `docs/features/groups/spec.md` § 4 — debe actualizarse para reflejar los 2 nuevos permisos en la lista visible.
