# Stripe / billing diferido a Fase 3

**Fecha:** 2026-05-01
**Estado:** Aceptada
**Origen:** M4 + parte de m5 del audit checklist 2026-05-01.

## Contexto

El roadmap (`docs/roadmap.md`, `docs/blueprint.md`) ubica billing en **Fase 3** del proyecto. El MVP funciona sin billing: places en `OWNER_PAYS` mode (admin paga manual o freemium hasta Fase 3).

Hoy hay **infraestructura mínima** para Stripe sin lógica de procesamiento:

| Pieza                                  | Estado                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/lib/stripe.ts`             | SDK singleton con API version pineada (`2026-03-25.dahlia`). Tira si `STRIPE_SECRET_KEY` no existe.                                    |
| `src/shared/config/env.ts`             | 4 env vars opcionales: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. |
| `.env.example`                         | Las 4 vars listadas vacías.                                                                                                            |
| `src/app/api/webhooks/stripe/route.ts` | Stub: verifica firma, loguea `event.id + event.type` a pino, retorna 200. **Descarta el evento sin procesarlo.** TODO marcando Fase 3. |
| `vercel.json` cron entries             | Ninguna entry de billing (solo erasure).                                                                                               |

**Ausente** (todo Fase 3):

- Modelos Prisma `Subscription`, `Customer`, `Invoice`.
- UI `/settings/billing`.
- Stripe Customer creation al onboarding.
- Handlers por `event.type`: `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`, `account.updated`.
- Lógica que transicione `Place.billingMode` (el enum existe en schema con `OWNER_PAYS | TRIAL | PAST_DUE | ...` pero ningún código lo cambia).
- Stripe Connect flow (multi-tenant billing).

## Riesgo identificado por el audit (M4)

El webhook stub retorna 200 a todo evento. **Stripe no reintenta tras 200**. Si Stripe se activa accidentalmente en producción (alguien crea un Customer testing, alguien usa `STRIPE_SECRET_KEY` real), los eventos se reciben + descartan + se pierden para siempre.

Mitigación propuesta originalmente: persistir los eventos en una tabla `stripe_event_log` append-only para backfillear cuando llegue Fase 3.

## Decisión

**Aceptamos la pérdida de eventos pre-Fase 3** sin implementar `stripe_event_log`. Razones:

1. **No hay subscriptions activas en producción**. Sin `STRIPE_SECRET_KEY` configurada (estado actual prod), el webhook responde 200 sin invocar al SDK. No hay eventos reales a perder porque no hay flow de creación.
2. **Riesgo de activación accidental es bajo**. Las 4 env vars de Stripe son opcionales y vacías en `.env.example`. Activarlas requiere acción deliberada.
3. **Implementar `stripe_event_log` ahora es trabajo prematuro**. Cuando llegue Fase 3, la decisión de schema (campos del log, retention, índices, RLS) depende de qué eventos se manejarán y cómo. Hacerlo hoy invierte sin contexto.
4. **Fase 3 traerá un audit dedicado de billing**. Ese audit incluirá: modelo de subscription completo, handlers, error retry strategy, reconciliación con Stripe API, y la decisión de log/queue (con o sin tabla).

## Implicancias

- `src/app/api/webhooks/stripe/route.ts` queda como está. El TODO del comment marca explícitamente Fase 3.
- Si en cualquier momento alguien activa Stripe pre-Fase 3 (ej: configura las env vars y crea un Customer testing), debe **revisar esta ADR antes** y considerar agregar `stripe_event_log` ad-hoc.
- El logger pino captura `{ eventId, eventType }` en el stub — hay rastro mínimo si se necesita inspeccionar manualmente qué llegó.

## Cuándo revisar

- Al arrancar Fase 3 (billing implementation kickoff).
- Si se decide testear Stripe en staging antes de Fase 3 (subir las env vars, crear Customer de prueba).
- Si Stripe agrega tipos de evento críticos que no podemos perder (ej: chargebacks pre-billing — improbable pero posible).

## No aplica

Esta ADR **no** autoriza:

- Activar Stripe en producción sin implementar Fase 3 completa primero.
- Eliminar el endpoint `/api/webhooks/stripe` (debe seguir respondiendo 200 con verificación de firma para que Stripe no marque el endpoint como dead).
- Agregar nuevos `event.type` al stub sin lógica real (rotaría el TODO sin progreso).

## Referencias

- `src/app/api/webhooks/stripe/route.ts` — stub actual.
- `src/shared/lib/stripe.ts` — SDK singleton.
- `docs/roadmap.md` § Fase 3.
- `docs/plans/2026-05-01-audit-checklist.md` § M4.
