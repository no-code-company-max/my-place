# Billing: tres modos

Place soporta tres modelos de cobro desde el MVP. Cada place tiene exactamente uno activo, definido al crearlo.

## Modo 1: `OWNER_PAYS`

- El owner paga suscripción mensual/anual al producto Place
- Stripe: Customer + Subscription
- Miembros no pagan nada
- Si la suscripción falla: gracia de 7 días, después el place se suspende
- Implementación: Stripe Checkout + webhook para eventos de subscription

## Modo 2: `OWNER_PAYS_AND_CHARGES`

- El owner paga suscripción a Place (como modo 1)
- Además puede cobrar a los miembros por unirse
- Stripe Connect Express para que el owner reciba pagos
- Cada invitación puede incluir un precio; el miembro paga al aceptar
- El owner define precios (único, mensual, anual)
- Implementación: Connect onboarding + Payment Intent al aceptar invitación

## Modo 3: `SPLIT_AMONG_MEMBERS`

Reglas del producto:

- El owner configura una cantidad fija mensual y elige X miembros que dividen el costo
- División **igualitaria y fija** entre esos X miembros
- Cada co-pagador tiene su propia Subscription en Stripe que paga su fracción, con el owner como destino via Connect
- Si un co-pagador falla el pago: gracia de 7 días, después el place se suspende completo (el lugar es compartido, el pago también)
- Cambiar composición de co-pagadores requiere flow explícito que cancela subs actuales y crea nuevas
- Agregar/remover co-pagadores requiere confirmación de los afectados
- Sin prorrateo para altas a mitad de mes — el miembro paga desde el próximo ciclo
- Sin redistribución automática si un co-pagador sale — el owner decide

## Reglas comunes

- **Free trial de 14 días** al crear un place, sin tarjeta requerida
- Pasado el trial sin billing configurado: el place entra en `pending_billing` — todos pueden leer, nadie escribe
- Si el owner configura billing válido: el place se activa
- Si no configura en 7 días después del trial: el place se archiva (no se borra, se puede reactivar)

## Estados del place

| Estado            | Descripción                                                |
| ----------------- | ---------------------------------------------------------- |
| `trial`           | Primeros 14 días desde creación                            |
| `active`          | Billing configurado y pagado                               |
| `pending_billing` | Requiere acción del owner                                  |
| `suspended`       | Pago fallido por más de la gracia                          |
| `archived`        | Archivado manual o por abandono tras suspensión prolongada |

## Webhooks de Stripe

Los eventos de Stripe que manejamos en `app/api/webhooks/stripe/route.ts`:

- `customer.subscription.created` → activar el place
- `customer.subscription.updated` → sincronizar estado
- `customer.subscription.deleted` → suspender el place
- `invoice.payment_failed` → iniciar gracia de 7 días
- `invoice.payment_succeeded` → restaurar place si estaba suspendido
- `account.updated` (Connect) → sincronizar estado del onboarding del owner

## Seguridad

- **Webhook signature verification** obligatoria en cada request a `/api/webhooks/stripe`
- Secrets de Stripe solo en env vars, nunca en código
- Test mode durante desarrollo; switch a production mode es decisión explícita y registrada

## Cambio de modo

Cambiar el billing mode de un place existente es operación no trivial:

- Cancela las subscriptions actuales
- Crea nuevas según el nuevo modo
- Requiere confirmación del owner y de los afectados (si es split)
- El place pasa por `pending_billing` durante la transición

Para MVP: cambio de modo es feature v2. En MVP, el modo se elige al crear y no se cambia.
