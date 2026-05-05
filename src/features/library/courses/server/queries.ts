import 'server-only'
import { cache } from 'react'
import { prisma } from '@/db/client'

/**
 * Queries server-only del sub-slice `library/courses`.
 *
 * Performance-crítico: `listCompletedItemIdsByUser` es invocado por
 * el listing de categorías-curso para evaluar `canOpenItem` por cada
 * item rendereado. React.cache deduplica por request (gotcha CLAUDE.md
 * `connection_limit=1`).
 *
 * NO chequeamos read access ni gateamos por `kind === 'COURSE'` —
 * estas queries son neutrales al contenido. El caller compone con
 * `canReadCategory` / `canOpenItem` según corresponda.
 */

/**
 * Lista los IDs de items que el usuario marcó como completados en un
 * place dado. Filtrado por `placeId` para no leakear completions de
 * otros places del mismo user (defense in depth + paginable si crece).
 *
 * Cacheado por request: una page que rendereiza N items invoca esta
 * query 1 vez en el RSC; el resultado se reutiliza al mapear cada item.
 */
export const listCompletedItemIdsByUser = cache(
  async (userId: string, placeId: string): Promise<string[]> => {
    const rows = await prisma.libraryItemCompletion.findMany({
      where: {
        userId,
        item: { placeId },
      },
      select: { itemId: true },
    })
    return rows.map((r) => r.itemId)
  },
)

/**
 * Forma mínima del item para construir la cadena de prereqs.
 */
export type ItemForPrereqChain = {
  id: string
  prereqItemId: string | null
}

/**
 * Cadena de prereqs ascendente de un item.
 *
 * Ejemplo: si C tiene prereq B, y B tiene prereq A, entonces para
 * `findItemPrereqChain('C', allItems)` retorna `[B, A]`. El primer
 * elemento es el prereq directo, el último es el "más profundo".
 *
 * Útil para mostrar "Para abrir esto necesitás A → B" en la UI cuando
 * un item está locked. El caller pasa `allItems` ya cargado (típicamente
 * los items de la misma categoría) — no hace queries por nivel.
 *
 * Función pura. Cap defensivo de 50 niveles (consistente con
 * `validateNoCycle`) — si la cadena viola el cap, corta y retorna lo
 * que tenga (data corrupta no debería romper el render).
 */
export function findItemPrereqChain(
  itemId: string,
  allItems: ReadonlyMap<string, ItemForPrereqChain>,
): Array<{ id: string }> {
  const out: Array<{ id: string }> = []
  const start = allItems.get(itemId)
  if (!start || start.prereqItemId === null) return out

  let current: string | null = start.prereqItemId
  let depth = 0
  const MAX_DEPTH = 50
  const visited = new Set<string>([itemId])

  while (current !== null && depth < MAX_DEPTH) {
    if (visited.has(current)) {
      // Ciclo detectado en data — defensive break (no debería pasar
      // porque set-item-prereq valida no-ciclo, pero si el state es
      // inconsistente preferimos cortar antes que loop infinito).
      break
    }
    visited.add(current)
    out.push({ id: current })

    const next = allItems.get(current)
    if (!next) break
    current = next.prereqItemId
    depth += 1
  }

  return out
}
