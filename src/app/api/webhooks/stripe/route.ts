import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/shared/config/env'
import { getStripe } from '@/shared/lib/stripe'
import { logger } from '@/shared/lib/logger'

/**
 * Webhook handler de Stripe.
 *
 * En Fase 3 (billing) se implementan los handlers por event type:
 * - customer.subscription.{created,updated,deleted}
 * - invoice.payment_{succeeded,failed}
 * - account.updated (Connect)
 *
 * Por ahora: verifica firma y loguea. Devuelve 200 para que Stripe no reintente.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing stripe-signature' }, { status: 400 })
  }

  if (!serverEnv.STRIPE_SECRET_KEY || !serverEnv.STRIPE_WEBHOOK_SECRET) {
    logger.warn('Stripe webhook recibido pero las keys no están configuradas (Fase 3 pendiente).')
    return NextResponse.json({ received: true, phase: 'pre-billing' }, { status: 200 })
  }

  const payload = await req.text()

  try {
    const stripe = getStripe()
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      serverEnv.STRIPE_WEBHOOK_SECRET,
    )
    logger.info({ type: event.type, id: event.id }, 'stripe webhook')
    // TODO(Fase 3): despachar al handler correspondiente por event.type
    return NextResponse.json({ received: true })
  } catch (err) {
    logger.error({ err }, 'stripe webhook signature verification failed')
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }
}
