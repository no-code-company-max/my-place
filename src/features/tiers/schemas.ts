/**
 * Zod schemas de input de las server actions del slice `tiers` (T.3).
 *
 * Validan la estructura del input que viene del cliente. Las reglas de
 * negocio (caps, formato) viven también en `domain/invariants.ts` —
 * Zod cubre estructura, invariants cubren reglas. Mantener ambos en
 * sync; tests unit del dominio garantizan que coincidan.
 *
 * `currency` v1 se hardcodea a `z.enum(['USD'])`. Cuando llegue Stripe
 * Connect, extender el enum sin cambiar la migración.
 *
 * Ver `docs/features/tiers/spec.md` § 9.
 */

import { z } from 'zod'
import {
  TIER_DESCRIPTION_MAX_LENGTH,
  TIER_NAME_MAX_LENGTH,
  TIER_NAME_MIN_LENGTH,
  TIER_PRICE_CENTS_MAX,
  TIER_PRICE_CENTS_MIN,
} from './domain/invariants'
import { TIER_DURATION_VALUES, TIER_VISIBILITY_VALUES } from './domain/types'

// ---------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------

const tierNameSchema = z
  .string()
  .min(TIER_NAME_MIN_LENGTH)
  .max(TIER_NAME_MAX_LENGTH)
  .refine((s) => s.trim().length >= TIER_NAME_MIN_LENGTH, {
    message: 'El nombre no puede estar vacío después de quitar espacios.',
  })

const tierDescriptionSchema = z.string().max(TIER_DESCRIPTION_MAX_LENGTH).nullable().optional()

const tierPriceCentsSchema = z.number().int().min(TIER_PRICE_CENTS_MIN).max(TIER_PRICE_CENTS_MAX)

// v1 hardcoded — cuando llegue Stripe Connect, extender el enum.
const tierCurrencySchema = z.enum(['USD']).default('USD')

// `as const satisfies` mantiene el typing narrow (cada valor literal del enum)
// y al mismo tiempo verifica que la lista coincide con `TIER_DURATION_VALUES`.
const tierDurationSchema = z.enum([
  'SEVEN_DAYS',
  'FIFTEEN_DAYS',
  'ONE_MONTH',
  'THREE_MONTHS',
  'SIX_MONTHS',
  'ONE_YEAR',
] as const satisfies readonly (typeof TIER_DURATION_VALUES)[number][])

const tierVisibilitySchema = z.enum([
  'PUBLISHED',
  'HIDDEN',
] as const satisfies readonly (typeof TIER_VISIBILITY_VALUES)[number][])

const placeSlugSchema = z.string().min(1).max(80)

const tierIdSchema = z.string().min(1)

// ---------------------------------------------------------------
// Inputs por action
// ---------------------------------------------------------------

export const createTierInputSchema = z.object({
  placeSlug: placeSlugSchema,
  name: tierNameSchema,
  description: tierDescriptionSchema,
  priceCents: tierPriceCentsSchema,
  currency: tierCurrencySchema,
  duration: tierDurationSchema,
})
export type CreateTierInput = z.infer<typeof createTierInputSchema>

export const updateTierInputSchema = z.object({
  tierId: tierIdSchema,
  name: tierNameSchema,
  description: tierDescriptionSchema,
  priceCents: tierPriceCentsSchema,
  currency: tierCurrencySchema,
  duration: tierDurationSchema,
})
export type UpdateTierInput = z.infer<typeof updateTierInputSchema>

export const setTierVisibilityInputSchema = z.object({
  tierId: tierIdSchema,
  visibility: tierVisibilitySchema,
})
export type SetTierVisibilityInput = z.infer<typeof setTierVisibilityInputSchema>
