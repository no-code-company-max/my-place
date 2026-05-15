# Cierre del experimento sub-slice `events/editor/`

**Fecha:** 2026-05-15
**Estado:** Aceptada
**Origen:** Detectado al diagnosticar por qué existían dos
`updateEventAction`. Espeja la decisión ya tomada para discussions en
`docs/decisions/2026-05-09-discussions-subslice-experiment-closed.md`
(mismo Approach C).

## Contexto

El cleanup G.7 (commit `d02da57`, 2026-05-05) introdujo sub-slices en
paralelo al legacy raíz como experimento de consolidación — en varios
slices a la vez. Para discussions el owner cerró el experimento el
2026-05-09 (Approach C: volver al raíz, borrar los sub-slices
paralelos) con ADR + commit `875b14b`.

**Para events el cierre se omitió.** El sub-slice `events/editor/`
quedó como copia zombi: 4 archivos (`public.ts`, `ui/event-form.tsx`,
`server/actions/create.ts`, `server/actions/update.ts`, ~527 LOC).

El barrel canónico `events/public.ts` nunca apuntó a `editor/` — siempre
exportó desde `events/server/actions/` y `events/ui/`. Cuando llegó el
port G.3 (`37153b5`, 2026-05-09) se aplicó solo al canónico, dejando la
copia `editor/` con un gate de permisos desactualizado.

### Diagnóstico fino del drift (verificado 2026-05-15)

| Archivo zombi                     | Canónico                          | Drift                                                                                                                                                                                        |
| --------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editor/server/actions/create.ts` | `events/server/actions/create.ts` | Solo paths de import (abs vs rel). Lógica idéntica.                                                                                                                                          |
| `editor/server/actions/update.ts` | `events/server/actions/update.ts` | Zombi con gate G.3 **viejo** + mensaje de error distinto. El canónico recibió el port G.3.                                                                                                   |
| `editor/ui/event-form.tsx`        | `events/ui/event-form.tsx`        | Zombi **pre-Lexical**: `<textarea>` + `buildDescription()` generando AST TipTap (`type:'doc'`). El canónico usa `<EventComposerWrapper>` Lexical + prop `placeId` + redirect `?from=events`. |
| `editor/public.ts`                | —                                 | Solo re-exports.                                                                                                                                                                             |

**Consumidores del zombi**: cero. `grep` de `@/features/events/editor`
y de cada path directo → vacío. **Tests que lo toquen**: cero.

## Decisión

Borrar el sub-slice `events/editor/` completo (Approach C, idéntico a
discussions). No se rescata nada: los 4 archivos son copia obsoleta y
estrictamente peor (pre-Lexical, pre-G.3), sin consumidores ni lógica
única.

La fuente de verdad única queda en el legacy raíz:

- `events/server/actions/{create,update}.ts` (con port G.3).
- `events/ui/event-form.tsx` (Lexical, re-exportado vía
  `events/forms/public.ts` → `events/public.ts`).

## Alternativas consideradas

### A. Dejar el zombi y solo documentarlo

Descartada. Viola "una responsabilidad por feature"; confunde (motivó
este diagnóstico); riesgo de que alguien importe el zombi por error y
use lógica de permisos G.3 desactualizada o un form pre-Lexical.

### B. Sincronizar `editor/` con el canónico y cablearlo

Descartada. Resucitar un sub-slice que el owner ya decidió no usar (la
decisión análoga de discussions es precedente explícito). Sumaría LOC y
mantenimiento doble sin beneficio.

## Consecuencias

- `-527 LOC` muertas eliminadas. Una sola `updateEventAction` /
  `createEventAction` / `EventForm` en el repo.
- Cero impacto runtime: el código era huérfano (confirmado por grep +
  suite completa 2122/2122 verde post-borrado).
- Coherencia con el cierre del experimento de discussions.

## Verificación post-cierre

- `pnpm typecheck` verde.
- `grep -rn 'events/editor' src/` → 0 hits.
- `pnpm vitest run` → 2122/2122 verde (cero regresión global).

## Referencias

- ADR precedente: `docs/decisions/2026-05-09-discussions-subslice-experiment-closed.md`
- Plan: `docs/plans/2026-05-15-events-editor-subslice-close.md`
- Commit del cleanup G.7 que introdujo el experimento: `d02da57`
- Port G.3 que solo tocó el canónico: `37153b5`
