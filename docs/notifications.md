# Notificaciones en el MVP

**El MVP no tiene notificaciones push.** Lo escribimos explícito porque Claude Code tiende a agregarlas si no se prohibe. Esto es decisión de producto anti-FOMO, no limitación técnica.

## Qué SÍ tenemos

- **Email**: para invitaciones, transferencia de ownership, eventos de billing (pago fallido, trial por vencer, etc.)
- **Digest diario opcional**: el usuario lo configura, recibe un email resumen de lo que pasó en sus places
- **Badge de mensajes sin leer**: solo visible dentro del place, no como notificación del sistema operativo

## Qué NO tenemos

- Push notifications del navegador (Web Push API)
- Toast notifications en tiempo real fuera del thread
- Badge del app en desktop/mobile
- Sonidos
- Emails por cada mensaje nuevo
- Notificaciones en el ícono del browser tab (título que parpadea, `[5] Place`)
- SMS
- Integraciones con Slack/Discord/WhatsApp

## Cómo se reemplaza la ausencia de notificaciones

El usuario descubre qué pasó en sus places de tres formas:

1. **Entra al place cuando quiere.** La portada le muestra el estado actual: quién está, qué discusión está viva, qué evento viene.
2. **Digest diario por email** (opcional): resumen de lo relevante.
3. **Badge contextual**: cuando entra al place ve cuántos mensajes nuevos hay en cada thread.

## Por qué esta decisión

Los productos cozy fallan cuando agregan notificaciones push "para retener usuarios". Cada ping erosiona la promesa de calma. El objetivo de Place no es que vuelvas cada 5 minutos — es que cuando vuelvas, sea porque querés.

## Cuando se revisa

En v2, con uso real del producto, podemos evaluar:

- ¿Hay casos legítimos donde una notificación aporta (ej: un evento empieza en 30 minutos y confirmaste)?
- ¿Los usuarios piden activamente algún tipo de notificación?
- ¿El email digest es suficiente o la gente lo ignora?

Si las respuestas justifican agregar algo, se diseña cuidadosamente con opt-in agresivo y defaults off. Nunca default on para cualquier notificación.
