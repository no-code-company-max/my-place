# Diferir observabilidad client-side hasta post-MVP launch

**Fecha:** 2026-05-01
**Estado:** Aceptada
**Origen:** m1-residual del audit checklist 2026-05-01.

## Contexto

Place tiene 2 error boundaries client-side que capturan crashes del navegador:

- **`src/app/error.tsx:11`** — root error boundary de Next.js. Atrapa cualquier crash no manejado en el cliente.
- **`src/features/shell/ui/zone-swiper.tsx:150`** — boundary del swiper de zonas (cross-zone navigation).

Ambos hoy hacen `console.error(error)` con un `// TODO: hook Sentry (Fase posterior)`.

**Diferencia con server**: errores server-side se loguean con `pino` y van a Vercel logs (visibilidad full). Errores client-side van **solo a la consola del browser del user** — invisibles para nosotros.

**Riesgo**: en producción con users reales, errores client-side se pierden. El user los sufre, los devs no se enteran.

## Opciones evaluadas

| Opción                                                       | Setup            | Costo recurrente                            | Cobertura                                      |
| ------------------------------------------------------------ | ---------------- | ------------------------------------------- | ---------------------------------------------- |
| **Dejar como está**                                          | $0               | $0                                          | Cero observabilidad client-side                |
| **Sentry SaaS** (sentry.io)                                  | ~2h SDK + config | Free tier 5K eventos/mes; ~$26/mes después  | Dashboard + agrupación + alertas               |
| **Highlight / LogRocket / Bugsnag**                          | ~2-3h            | Variable, generalmente más caro             | Similar a Sentry, algunos suman session replay |
| **PostHog** (cloud o self-hosted)                            | ~3h              | Free self-hosted; cloud tiene tier gratuito | Errores + analytics + feature flags integrados |
| **Endpoint propio** (`POST /api/errors` que loguea con pino) | ~4-6h            | $0                                          | Logs planos sin agrupación ni dashboard        |

## Decisión

**Diferir la decisión** hasta post-MVP launch. NO conectar ningún servicio ahora.

## Razones

1. **El código no está roto**. Los 2 error boundaries funcionan correctamente — atrapan el crash, evitan pantalla en blanco, ofrecen "Reintentar". Lo único que falta es el "buzón remoto" para que los devs vean qué pasó.

2. **Decisión depende del volumen real de users**. Sentry pago tiene sentido con ≥5K eventos/mes. PostHog o endpoint propio tienen sentido con presupuesto cero. Hoy no sabemos cuántos users reales tendrá Place ni el tolerance del producto a un servicio externo más.

3. **El costo de diferir es bajo en MVP**. En dev local y beta cerrada (≤20 users), los errores client-side aparecen en la consola del propio dev/tester. Sin pérdida de información significativa.

4. **El costo de migrar después es bajo**. Conectar cualquier servicio es ~30 min: agregar SDK + `init()` + reemplazar `console.error(error)` por `<Servicio>.captureException(error)` en los 2 puntos. Cero refactor estructural.

5. **Producto Place es cozytech low-volume**. Diseño explícito para ≤150 personas por place. La curva de errores en producción será baja por construcción del producto.

## Implicancias

- Hasta el primer milestone post-launch (Fase 8 según roadmap), errores client-side **no se reportarán remotamente**. Aceptamos el blind spot.
- Los `console.error(error)` quedan en los 2 boundaries como están. **No** son deuda técnica que requiera limpieza ni TODO bloqueante.
- En el primer review post-launch (cuando haya users reales), revisar esta ADR contra:
  - Volumen real de eventos esperados.
  - Presupuesto disponible.
  - Apetito por agregar un proveedor externo más.

## Cuándo revisar

Al ocurrir cualquiera de estos:

- **Place deploy a producción con users reales** (≥1 place real con miembros que no sean testers).
- **Reporte de bug client-side que no podamos reproducir** (señal de que la falta de observabilidad ya nos cuesta tiempo).
- **≥3 meses post-launch** sin haber tomado la decisión, forzar una revisión deliberada.

## No aplica

Esta ADR **no** autoriza:

- Eliminar los `console.error(error)` de los boundaries — siguen siendo el único log disponible mientras no haya servicio.
- Dejar de loguear errores nuevos client-side — cualquier nuevo error boundary debe seguir el mismo patrón (`console.error` + comentario apuntando a esta ADR).
- Diferir observabilidad **server-side** (que ya tenemos vía pino + Vercel logs).

## Referencias

- `docs/blueprint.md` — visión cozytech de Place (low-volume by design).
- `docs/architecture.md` § Principios de organización.
- `docs/plans/2026-05-01-audit-checklist.md` § m1-residual.
- Sentry Next.js docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- PostHog error tracking: https://posthog.com/docs/error-tracking
