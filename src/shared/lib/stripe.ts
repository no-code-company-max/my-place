import 'server-only'
import Stripe from 'stripe'
import { serverEnv } from '@/shared/config/env'

/**
 * Stripe SDK singleton. La versión de API se pinea explícitamente para
 * que upgrades del SDK no cambien el comportamiento silenciosamente.
 */
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    throw new Error(
      '[stripe] STRIPE_SECRET_KEY no configurado. Stripe es opcional en dev hasta Fase 3 (billing).',
    )
  }
  if (!_stripe) {
    _stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia',
      typescript: true,
    })
  }
  return _stripe
}
