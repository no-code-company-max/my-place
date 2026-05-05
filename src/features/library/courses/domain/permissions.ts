/**
 * Permisos del sub-slice `library/courses` — funciones puras.
 *
 * Replican la matriz del ADR `2026-05-04-library-courses-and-read-access.md`
 * (D2 + D3 + decisión #C "owner siempre puede"). Se usan en:
 *   - Server actions (gate antes de marcar/desmarcar completion).
 *   - UI condicional (lock badge, Mark Complete button).
 *   - Tests unit.
 *
 * Importa el shape `LibraryViewer` del parent slice via public — ese
 * tipo ya incluye `tierIds + isOwner` (G.1). Acá NO chequeamos read
 * access — eso vive en `library/access/`. Asumimos que el caller ya
 * gateó membership + read access en la page.
 */

import type { LibraryViewer } from '@/features/library/public'

/**
 * Forma mínima del item para evaluar prereqs. Sólo necesitamos
 * `prereqItemId` — el resto de campos del item no aplica al check.
 */
export type ItemForPrereqCheck = {
  prereqItemId: string | null
}

/**
 * ¿Puede el viewer marcar este item como completado?
 *
 * Cualquier miembro activo puede marcar (la membership ya fue verificada
 * por `resolveActorForPlace` en el caller). Owner OK también — no hay
 * razón para bloquearlo aunque marcar no le aporte (D3 ADR: el botón
 * Mark Complete es manual y el owner puede usarlo si quiere).
 *
 * Esta función existe principalmente como punto de extensión documentado
 * (en el futuro podrían sumarse reglas tipo "no marcar items archivados"
 * o "no marcar si la categoría no es COURSE"). Por ahora siempre `true`
 * porque el caller ya validó membership + read access.
 */
export function canMarkItemCompleted(_item: ItemForPrereqCheck, _viewer: LibraryViewer): boolean {
  return true
}

/**
 * ¿Puede el viewer abrir este item dado el estado de prereqs?
 *
 * Reglas (D2 + decisión #C ADR 2026-05-04):
 *  - Owner siempre puede abrir (bypass total — el owner ve todo el
 *    contenido del place sin restricciones).
 *  - Si el item NO tiene prereq → siempre se puede abrir.
 *  - Si tiene prereq → el viewer debe haberlo completado.
 *
 * NO chequea read access (eso es responsabilidad de `canReadItem` del
 * sub-slice access). El caller compone ambos checks.
 *
 * `completedItemIds` se obtiene de `listCompletedItemIdsByUser` —
 * cacheable por request (React.cache).
 */
export function canOpenItem(
  item: ItemForPrereqCheck,
  viewer: LibraryViewer,
  completedItemIds: ReadonlyArray<string>,
): boolean {
  if (viewer.isOwner) return true
  if (item.prereqItemId === null) return true
  return completedItemIds.includes(item.prereqItemId)
}
