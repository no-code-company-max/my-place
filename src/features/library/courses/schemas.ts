/**
 * Zod schemas de input de server actions del sub-slice `library/courses`
 * (G.3.a).
 *
 * Validan la forma estructural del input que viene del cliente. Las reglas
 * de dominio (existencia de items, no-ciclos, scope de moderación) viven
 * en las actions correspondientes. Acá sólo tipos + non-empty.
 */

import { z } from 'zod'

/**
 * Setea (override completo) el prereq de un item.
 *
 * Pasar `prereqItemId: null` LIMPIA el prereq (deja el item siempre
 * abrible). Action validará: item.category.kind === 'COURSE' (no se
 * setea prereq en GENERAL), prereq pertenece a la misma categoría, y
 * la asignación no forma ciclo.
 */
export const setItemPrereqInputSchema = z.object({
  itemId: z.string().min(1),
  prereqItemId: z.string().min(1).nullable(),
})
export type SetItemPrereqInput = z.infer<typeof setItemPrereqInputSchema>

/**
 * Marca un item como completado por el viewer actual. Idempotente.
 *
 * No requiere flag categoría==COURSE acá: si el viewer marca un item
 * GENERAL, la row queda escrita pero no afecta UI (no rendereamos
 * Mark Complete en GENERAL). El insert es barato y silencioso.
 */
export const markItemCompletedInputSchema = z.object({
  itemId: z.string().min(1),
})
export type MarkItemCompletedInput = z.infer<typeof markItemCompletedInputSchema>

/** Desmarca un item. Idempotente — `deleteMany` por (itemId, userId). */
export const unmarkItemCompletedInputSchema = z.object({
  itemId: z.string().min(1),
})
export type UnmarkItemCompletedInput = z.infer<typeof unmarkItemCompletedInputSchema>
