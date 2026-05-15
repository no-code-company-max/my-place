# Plan — Cierre del experimento sub-slice `events/editor/`

**Fecha**: 2026-05-15
**Estado**: en ejecución
**Approach**: C (volver al raíz, borrar el sub-slice) — mismo que se
aplicó a discussions (`docs/decisions/2026-05-09-discussions-subslice-experiment-closed.md`).

## Contexto

El cleanup G.7 (`d02da57`, 2026-05-05) introdujo sub-slices en paralelo
al legacy raíz como experimento de consolidación en varios slices. En
discussions el owner cerró el experimento (Approach C, ADR
2026-05-09). En **events el cierre se omitió**: `events/editor/` quedó
como copia zombi.

### Diagnóstico fino del drift (verificado 2026-05-15)

| Archivo zombi                            | Canónico                          | Drift                                                                                                                                                               |
| ---------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events/editor/server/actions/create.ts` | `events/server/actions/create.ts` | Solo imports (abs vs rel). Lógica idéntica.                                                                                                                         |
| `events/editor/server/actions/update.ts` | `events/server/actions/update.ts` | Zombi con **gate G.3 viejo** + mensaje distinto. Canónico recibió port G.3 (`37153b5`).                                                                             |
| `events/editor/ui/event-form.tsx`        | `events/ui/event-form.tsx`        | Zombi **pre-Lexical**: `<textarea>` + `buildDescription()` formato TipTap `type:'doc'`. Canónico usa `<EventComposerWrapper>` Lexical + `placeId` + `?from=events`. |
| `events/editor/public.ts`                | —                                 | Solo re-exports.                                                                                                                                                    |

**Consumidores del zombi**: CERO (grep de `@/features/events/editor` y
de cada path directo → vacío). **Tests que lo toquen**: CERO.

**Conclusión**: los 4 archivos son copia obsoleta y estrictamente peor
(pre-Lexical, pre-G.3), huérfana. Cero lógica única que rescatar.
Borrado = riesgo cero en runtime.

## Sesión única — Borrado + ADR

**Regla de oro**: cero regresión. Nada fuera de `events/editor/` se
toca (solo borrado + ADR + plan). Verificación typecheck + tests del
slice events + grep de refs residuales.

**Pasos**:

1. `git rm -r src/features/events/editor/` (4 archivos, ~527 LOC).
2. `pnpm typecheck` verde (nadie importa el zombi → no rompe).
3. `pnpm vitest run src/features/events` verde (cero regresión).
4. `grep -rn 'events/editor' src/` → 0 hits.
5. NEW `docs/decisions/2026-05-15-events-editor-subslice-experiment-closed.md`
   espejando estructura del ADR de discussions (Contexto, Decisión,
   Alternativas, Consecuencias, Verificación).
6. Commit único.

**LOC**: -527 (borrado) + ~70 (ADR) + plan. **Riesgo deploy**: cero
(código huérfano confirmado).

## Por qué una sola sesión

A diferencia del experimento discussions (drift bidireccional con
lógica viva en ambos lados → análisis exhaustivo), acá el zombi no
tiene consumidores ni lógica única ni tests. Es borrado mecánico de
bajo riesgo. Dividir en sesiones sería sobre-ingeniería.
