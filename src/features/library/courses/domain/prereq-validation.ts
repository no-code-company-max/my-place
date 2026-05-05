/**
 * Validación de ciclos en prereqs de items — función pura, app-layer.
 *
 * Cuando el owner setea un prereq para un item, debemos garantizar que
 * la cadena resultante NO forme un ciclo. Postgres no tiene constraint
 * nativo para esto sobre self-FKs nullable, así que el chequeo vive en
 * la action (D4 ADR `2026-05-04-library-courses-and-read-access.md`).
 *
 * Single prereq por item (D4) → la cadena es un linked list, no un
 * grafo. BFS lineal con cap defensivo de 50 niveles (cualquier cadena
 * práctica es <10 niveles; el cap evita bug-induced loops).
 */

/**
 * Cap defensivo en la profundidad de la cadena de prereqs. Si lo
 * superamos, asumimos data corrupta (un ciclo previo o cadena absurda)
 * y retornamos `false` (rechaza la asignación).
 */
export const PREREQ_CHAIN_MAX_DEPTH = 50

/**
 * Forma mínima del item para validar ciclos. Sólo necesitamos
 * `prereqItemId` para seguir la cadena.
 */
export type ItemForCycleCheck = {
  prereqItemId: string | null
}

/**
 * ¿Es seguro asignar `candidatePrereqId` como prereq de `itemId`?
 *
 * Retorna `true` si NO se forma ciclo, `false` si sí.
 *
 * Algoritmo: arrancamos en `candidatePrereqId` y seguimos la cadena de
 * prereqs hacia atrás. Si en algún paso encontramos `itemId`, el ciclo
 * está garantizado (porque la propuesta es itemId → candidatePrereqId,
 * y candidatePrereqId ya apunta de vuelta a itemId directa o
 * transitivamente). Cap a `PREREQ_CHAIN_MAX_DEPTH` niveles.
 *
 * Edge cases:
 *  - `itemId === candidatePrereqId` → autoreferencia → ciclo directo →
 *    `false`. Caso degenerado pero importante (input mal formado del UI).
 *  - `candidatePrereqId` no existe en `allItemsLookup` → tratamos como
 *    sin chain (no ciclo posible) → `true`. La validación de existencia
 *    es responsabilidad del caller (la action chequea por separado).
 *  - Cadena profunda que excede el cap → `false` defensivo.
 *
 * `allItemsLookup` es un Map para acceso O(1) por id. El caller lo
 * construye una vez por action (no per-iteration).
 */
export function validateNoCycle(
  itemId: string,
  candidatePrereqId: string,
  allItemsLookup: ReadonlyMap<string, ItemForCycleCheck>,
): boolean {
  // Autoreferencia directa: itemId apuntando a sí mismo.
  if (itemId === candidatePrereqId) return false

  // Si candidatePrereqId no existe en el lookup, no podemos formar
  // ciclo siguiendo la cadena (no hay nada que seguir). El caller
  // valida la existencia por separado.
  let current: string | null = candidatePrereqId
  let depth = 0

  while (current !== null) {
    if (depth >= PREREQ_CHAIN_MAX_DEPTH) {
      // Cadena demasiado larga — defensivo. Asumimos data corrupta.
      return false
    }
    // Si en algún punto del chain volvemos a `itemId`, hay ciclo.
    if (current === itemId) return false

    const next = allItemsLookup.get(current)
    if (next === undefined) {
      // El chain referencia un item inexistente — interrumpe el seguimiento
      // sin reportar ciclo. El caller debió validar existencia antes.
      return true
    }
    current = next.prereqItemId
    depth += 1
  }

  return true
}
