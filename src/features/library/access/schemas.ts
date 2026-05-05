/**
 * Zod schemas del sub-slice `library/access` (G.2.a).
 *
 * Validan el input del único action del sub-slice:
 * `setLibraryCategoryReadScopeAction`. Forma discriminated union por
 * `kind` — el set de IDs cambia según el discriminator.
 *
 * Cap a 50 entries (defensive). Place tiene max 150 miembros, scopes
 * típicos < 20 según el ADR § "Riesgos".
 *
 * Ver `docs/decisions/2026-05-04-library-courses-and-read-access.md` § D6.
 */

import { z } from 'zod'

const READ_SCOPE_MAX_ENTRIES = 50

const idSchema = z.string().min(1)

/**
 * Discriminated union por `kind`. Cada variante exige sólo el campo de
 * IDs relevante (sin payload mismatch — payloads que mezclen `kind:'GROUPS'`
 * con `userIds: [...]` son rechazados por Zod).
 */
export const setLibraryCategoryReadScopeInputSchema = z.discriminatedUnion('kind', [
  z.object({
    categoryId: idSchema,
    kind: z.literal('PUBLIC'),
  }),
  z.object({
    categoryId: idSchema,
    kind: z.literal('GROUPS'),
    groupIds: z.array(idSchema).max(READ_SCOPE_MAX_ENTRIES),
  }),
  z.object({
    categoryId: idSchema,
    kind: z.literal('TIERS'),
    tierIds: z.array(idSchema).max(READ_SCOPE_MAX_ENTRIES),
  }),
  z.object({
    categoryId: idSchema,
    kind: z.literal('USERS'),
    userIds: z.array(idSchema).max(READ_SCOPE_MAX_ENTRIES),
  }),
])

export type SetLibraryCategoryReadScopeInput = z.infer<
  typeof setLibraryCategoryReadScopeInputSchema
>
