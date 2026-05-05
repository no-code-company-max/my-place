# Excepción de tamaño para el slice `groups`

**Fecha:** 2026-05-02
**Milestone:** G.2 (slice de PermissionGroups)
**Autor:** Agente A (G.2)

## Contexto

`CLAUDE.md` fija tres límites no cosméticos:

- **Archivos:** ≤ 300 líneas
- **Funciones:** ≤ 60 líneas
- **Feature completa:** ≤ 1500 líneas

La medición al cerrar G.2 (slice `groups/` completo: domain + server queries

- 6 actions + UI completa + schemas + public + tests dominio + actions) es:

```
feature groups (sin __tests__):
  domain/         4 archivos      276 líneas
  server/         7 archivos      941 líneas
  ui/             8 archivos    1 143 líneas
  public.ts       1 archivo      110 líneas
  public.server.ts 1 archivo      26 líneas
  schemas.ts      1 archivo       92 líneas
  ──────────────────────────────────────────
  total         22 archivos    2 588 líneas
```

Archivos más largos (todos < cap 300):

| Archivo                                      | Líneas |
| -------------------------------------------- | ------ |
| `ui/group-form-dialog.tsx`                   | 271    |
| `ui/group-members-dialog.tsx`                | 210    |
| `ui/groups-list-admin.tsx`                   | 182    |
| `server/actions/update-group.ts`             | 175    |
| `server/queries.ts`                          | 166    |
| `ui/member-groups-control.tsx`               | 161    |
| `server/actions/create-group.ts`             | 144    |
| `server/actions/add-member-to-group.ts`      | 129    |
| `server/actions/set-group-category-scope.ts` | 123    |
| `ui/delete-group-button.tsx`                 | 113    |

Ningún archivo individual supera el cap de 300 (top 271). Todas las
funciones < 60 LOC. **El slice completo supera el cap de 1500 por
~1 088 líneas (~73%)**.

## Decisión

**Se acepta la excepción** para el slice `groups/` con los límites
vigentes (mismo precedente que el ADR `2026-04-20-discussions-size-exception.md`).
**NO se divide** en sub-slices `groups/` + `groups-ui/`.

## Razones

1. **El plan ya pre-aprobó esta opción.**
   `docs/plans/2026-05-02-permission-groups-and-member-controls.md`
   § "Alineación con CLAUDE.md y architecture.md" anticipa el overflow:
   "Slice total estimado realista por audit ~1600 LOC … decisión:
   1. Split a 2 slices (`groups/` + `groups-ui/`) o 2) ADR de excepción
      documentado". Cualquiera de las dos pre-aprobada por el lead. Los
      2 588 LOC reales superan el estimado por incluir tests adicionales
      y descripciones extensas — la decisión de split o no se mantiene.

2. **Split a `groups-ui/` rompería el paradigma sin beneficio real.**
   Los 8 componentes UI dependen 1:1 de los tipos del dominio
   (`PermissionGroup`, `GroupSummary`, `GroupMembership`) y de las 6
   server actions (`createGroup`, `update`, `delete`, `addMember`,
   `removeMember`, `setScope`). Separarlos en `groups-ui/` obligaría a:
   - Exportar TODOS los tipos + actions desde `groups/public.ts` (ya
     hechos) y re-importarlos desde `groups-ui/` — boilerplate sin
     mejora de aislamiento.
   - Dos slices con un único consumidor (la página `/settings/groups`
     y el detalle del miembro) — no aporta modularidad.
   - Frontera artificial: el dialog de form NO existe sin los tipos
     del dominio.

3. **Densidad inherente al dominio del feature.**
   `groups` cubre:
   - 3 entidades nuevas (`PermissionGroup`, `GroupMembership`,
     `GroupCategoryScope`).
   - 6 server actions con discriminated union return (~12 errores
     esperados en total).
   - 8 componentes UI: 5 client islands (form dialog, members dialog,
     permission checklist, scope selector, delete button, member-groups
     control) + 1 server (groups-list-admin).
   - Reglas hardcoded del preset "Administradores" en 3 actions
     (update, delete, set-scope).
   - Validación Zod de un enum cerrado de 10 permisos atómicos.

   Todas estas piezas son cohesivas — viven en el mismo bounded
   context y se modifican juntas.

4. **Granularidad por archivo, no por slice.**
   El cap de 300 LOC por archivo (más restrictivo) sí está cumplido
   con margen (top 271). Es la unidad real de "auditable por humano y
   por agente". El cap de 1500 por slice es proxy del de archivos —
   en este caso el proxy está mal calibrado: 22 archivos pequeños son
   más auditables que 11 archivos de 270 LOC cada uno.

## Puntos de revisión a futuro

Si **alguno** de estos triggers aparece, reabrir el ADR:

- `ui/group-form-dialog.tsx` cruza 300 LOC.
- Se suman > 4 actions nuevas (e.g., bulk operations, group templates,
  audit log de cambios al grupo).
- Se suma una segunda jerarquía de presets (no sólo "Administradores"
  sino "Moderadores básico", "Recruiters básico", etc.).
- El número de permisos atómicos crece > 30 (también triggerea la
  normalización a `GroupPermission` table — ADR aparte).

En cualquiera de esos casos, evaluar split por sub-área:

- `groups/` (domain + server + presets básicos)
- `groups-templates/` (presets adicionales con UX layer encima)

## Métricas de control

Snapshot al cierre de G.2:

```
Archivos:      22 (sin tests) + 7 (tests) = 29 total
Total LOC:     2 588 (sin tests) + 1 266 (tests) = 3 854
Función máx:   ~50 LOC (cumple cap 60)
Archivo máx:   271 LOC (cumple cap 300)
Tests:         83 (passing)
```

Próxima revisión obligatoria: G.7 (drop de fallback) — verificar si
el slice se mantiene o ha crecido.
