# Cierre del experimento sub-slice `discussions/{posts,comments,moderation}/`

**Fecha:** 2026-05-09
**Estado:** Aceptada
**Origen:** Aplicación del Approach C del plan G.3 port (`docs/plans/2026-05-09-g3-debt-port-to-legacy.md`). Decisión del owner tras análisis exhaustivo de drift bidireccional documentado en `docs/plans/2026-05-09-posts-comments-analysis.md`.

## Contexto

El cleanup G.7 (commit `d02da57`, 5 May 2026) introdujo 3 sub-slices en paralelo al legacy raíz como experimento de consolidación:

- `src/features/discussions/posts/` (~1004 LOC)
- `src/features/discussions/comments/` (~1354 LOC)
- `src/features/discussions/moderation/` (~170 LOC)

Los 3 nacieron orphan (cero consumers externos) con la intención de migrar incrementalmente. Mientras tanto el legacy raíz siguió recibiendo features:

- F.3 RichTextRenderer Lexical (sub-slice quedó con stub F.1 "Contenido temporalmente deshabilitado").
- Audit #5 snapshot validation pre-insert.
- Audit #3 broadcast `post_hidden` + watcher cliente.
- Lazy realtime appender (~12-15 kB gzip ahorro First Load).
- `revalidatePath('/${placeSlug}')` para home dinámica futura.

Los sub-slices, en cambio, recibieron sólo G.3 atomic permissions (`hasPermission(...)`).

Resultado: **drift bidireccional** — ninguno era source-of-truth completa. El análisis B.4/B.5 (`docs/plans/2026-05-09-posts-comments-analysis.md`) reveló que consolidar el sub-slice promovería regresiones críticas (visual: comments mostraría placeholder F.1; perf: bundle First Load +12-15 kB).

## Decisión

**Borrar los 3 sub-slices completos** y portar G.3 al legacy en su lugar (Approach C del plan G.3 port).

Archivos eliminados (35 totales, ~2700 LOC):

- `src/features/discussions/posts/` — 11 archivos (public + 8 actions + queries + 3 tests)
- `src/features/discussions/comments/` — 19 archivos (public + 5 actions + 1 query + 9 UI + 2 tests + helper)
- `src/features/discussions/moderation/` — 3 archivos (public + 1 UI + dir tests vacío)
- `src/features/discussions/server/queries/index.ts` (re-export orphan)

Re-puntados (los 4 únicos importadores externos al sub-slice):

- `src/features/discussions/server/actions/load-more.ts` — `listCommentsByPost` + `CommentView` ahora desde `'../queries'` legacy.
- `src/features/discussions/presence/__tests__/post-event-relation.test.ts` — `findPostById` + `findPostBySlug` ahora desde `'@/features/discussions/server/queries'` legacy.

## Alternativas consideradas

### A. Approach A — Port G.3 al legacy + dejar sub-slices (descartada)

Sólo portar G.3 al legacy, mantener sub-slices como deuda muerta hasta una migración futura.

- **Pros**: scope acotado al fix de seguridad.
- **Cons**: sub-slices siguen en el repo como código zombi, riesgo activo de drift entre copias en cada sesión que toque discussions, ~2700 LOC sin uso.

### B. Approach B — Reconciliar sub-slice + promover (descartada)

Portar al sub-slice las features que le faltaban (F.3 + Audit #5 + lazy realtime + broadcast post_hidden + revalidate /home), después wirear al barrel y borrar legacy.

- **Pros**: cierra deuda + consolida.
- **Cons**: 5-12h efectivas vs 9h del Approach A. Riesgo CRÍTICO de regresión visual (placeholder F.1 si el port de RichText fallaba). Requiere reconciliar 5 features distintas, cada una con su propio gotcha. Bloquea fix de seguridad hasta que B.4/B.5 estén verdes.

### C. Approach C — Port G.3 al legacy + borrar sub-slices (elegida)

Cierra deuda funcional Y elimina drift permanente.

- **Pros**: descarga mental (una sola fuente de verdad), single concern por sub-fase, cierra el experimento abandonado de manera explícita.
- **Cons**: pierde ~2400 LOC de código del sub-slice (mayoritariamente duplicado del legacy + G.3 implementation que se portó). Decisión arquitectónica grande que requiere ADR (este doc).

## Consecuencias

### Cierre de planes pendientes

- **B.4 (`discussions/posts/` consolidation)**: **CANCELADO**. El sub-slice ya no existe; no hay nada que consolidar.
- **B.5 (`discussions/comments/` consolidation)**: **CANCELADO**. Idem.
- **F1 (test mal ubicado en `presence/__tests__/post-event-relation.test.ts`)**: cerrado parcial — el test sigue mal ubicado pero ya no apunta a un sub-slice; apunta al legacy `queries.ts`. Mover a `posts/__tests__/` queda como follow-up de menor prioridad.
- **F2 (acoplamiento cross-sub-slice de helpers privados)**: **CERRADO**. Los helpers privados (`fetchLastReadByPostId`, etc.) viven solo en `presence/server/queries/post-readers.ts` y los consume el legacy `queries.ts:listPostsByPlace`. Acoplamiento simétrico, sin cross-sub-slice.

### B.3 (`discussions/threads/` consolidation) — vigente

`discussions/threads/` sigue siendo sub-slice orphan que NO se borra en este ADR. Razón: B.3 fue planeado independientemente (`docs/plans/2026-05-09-threads-subslice-migration.md`) con auditoría empírica de que sus archivos son byte-equivalentes al legacy (solo paths difieren). El sub-slice threads NO sufrió drift como posts/comments — su consolidación sigue siendo viable. Decisión sobre ejecutarlo o también cerrarlo (símil C) queda pendiente.

### LOC del slice raíz

- Pre-port G.3: 6176 LOC.
- Post-port G.3 + cierre sub-slices: 6202 LOC (+26 — los `if hasPermission` y comentarios suman).
- Sub-slices borrados: ~2528 LOC fuera del repo (ya descontaban del raíz por estar en sub-slices, pero ya no son deuda muerta).

**El cap 1500 sigue violado** (excepción autorizada por `docs/decisions/2026-04-20-discussions-size-exception.md`). El cierre de los sub-slices NO acerca al cap, pero elimina la deuda invisible de mantener copias drifteando.

### Pendientes para cerrar la excepción de tamaño

Documentado en el ADR `2026-04-20-discussions-size-exception.md` (que requiere update separado tras este cierre):

- **B.3 threads** sigue vigente (-550 LOC esperados si se ejecuta).
- Composers/event-composer-form sub-split posible.
- Sin estos, el raíz queda en ~5650 LOC tras B.3 — sigue 4× sobre el cap. La excepción será permanente con cap mayor autorizado.

### G.3 atomic permissions ahora honrado en producción

**Esto es lo que cierra la deuda funcional**. Pre-port: custom group con permiso atómico delegado quedaba ignorado por gates legacy. Post-port: 13 actions del legacy honran `hasPermission(...)`. Owner + preset group + custom group con permiso correspondiente pueden moderar.

Permisos delegables aplicados:

- `discussions:hide-post` — moderate.ts (hide/unhide) + load-more.ts (visibility en listings).
- `discussions:delete-post` — delete.ts.
- `discussions:edit-post` (NUEVO, override de ADR §2 — ver `docs/decisions/2026-05-09-g3-edit-as-delegable-permission.md`) — edit.ts (editPostAction + openPostEditSession).
- `discussions:delete-comment` — comments/delete.ts.
- `library:moderate-categories` (con scope categoryId opcional) — 6 actions de categories + 2 contributors.
- `library:edit-item` (NUEVO, override de ADR §2) — items/update-item.ts.
- `events:moderate` — events/{update,cancel}.ts.
- `flags:review` — flags/reviewFlagAction.

### Tests legacy actualizados

- `discussions/__tests__/posts-actions.test.ts`: mock `groupMembership.findMany` agregado, `mockActiveMember({ asAdmin: true })` simula preset group.
- `discussions/__tests__/comments-actions.test.ts`: idem.
- `events/__tests__/actions.test.ts`: idem.
- Tests de flags (`flags/__tests__/actions.test.ts`) ya estaban G.3-aware desde antes.
- Tests de library (`library/__tests__/`) ya estaban G.3-aware en el sub-slice — ahora que el sub-slice se borró, los tests legacy de library siguen pasando porque la cobertura del path G.3 vive en cada action test individual.

### Smoke pendiente

El plan G.3 port (`docs/plans/2026-05-09-g3-debt-port-to-legacy.md`) § 4 documenta un smoke check exhaustivo con 3 users custom-group para validar la delegación atómica. **Ese smoke queda pendiente** — no se ejecutó en esta sesión por costo (setup en producción).

Mitigación: la pre-flight via MCP supabase confirmó **0 grupos custom delegados de usuarios reales hoy** (solo 2 del seed E2E). La deuda era preventiva, no activa. El smoke puede agendarse:

- **Antes del lanzamiento público** (más probable).
- **Antes del primer owner real que cree un grupo custom delegado** (event-driven).

Sumar al `docs/pre-launch-checklist.md` como item.

### No requiere migration de DB

`PermissionGroup.permissions` es `text[]`. Los 2 nuevos permisos atómicos (`discussions:edit-post`, `library:edit-item`) se suman al enum en código sin migration. Validación Zod en `createGroup`/`updateGroup` los acepta automáticamente.

## Verificación post-cierre

```bash
pnpm typecheck                         # ✅ verde
pnpm vitest run                        # ✅ 1896/1896 verde
pnpm test --run tests/boundaries.test.ts  # ✅ 3/3 verde
pnpm tsx scripts/lint/check-slice-size.ts # discussions raíz 6202 (sigue violando cap)

grep -rn "discussions/posts/\|discussions/comments/\|discussions/moderation" src tests
# Solo 1 ref textual residual: comentario en update-item.test.ts:464 (cosmético)
```

## Referencias

- Plan G.3 port `docs/plans/2026-05-09-g3-debt-port-to-legacy.md` — origen del trabajo.
- Análisis B.4/B.5 `docs/plans/2026-05-09-posts-comments-analysis.md` — análisis del drift bidireccional.
- Plan B.3 `docs/plans/2026-05-09-threads-subslice-migration.md` — sigue vigente (NO afectado por este cierre).
- ADR `docs/decisions/2026-05-09-g3-edit-as-delegable-permission.md` — override de ADR §2 con los 2 permisos nuevos.
- ADR original `docs/decisions/2026-05-02-permission-groups-model.md` — modelo G.3 base.
- ADR cleanup G.7 (commit `d02da57`) — origen del experimento sub-slice.
- ADR `docs/decisions/2026-04-20-discussions-size-exception.md` — excepción de tamaño autorizada (sigue vigente).
