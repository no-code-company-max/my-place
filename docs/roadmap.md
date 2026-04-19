# Roadmap del MVP

Orden de construcción priorizado para minimizar bloqueos y permitir iteración. Cada fase es aproximadamente una semana, ajustar al ritmo real.

## Fase 1 — Infraestructura

- Next.js 15 + TypeScript strict + Tailwind
- eslint con `no-restricted-paths`
- Supabase proyecto creado, variables de entorno configuradas
- Prisma con schema inicial (User, Place, Membership, PlaceOwnership, Invitation)
- Supabase Auth configurado (magic link como primer método)
- Middleware de Next.js para routing multi-tenant por subdomain
- Wildcard DNS en Vercel (staging primero)
- Layout base + tema default con CSS variables

**Entregable**: `prueba.place.app` responde, hay login, se crea user en DB.

## Fase 2 — Places + Members

- Feature `places`: crear, listar, archivar
- Feature `members`: invitar por email, aceptar invitación, salir del place
- Ownership: múltiples owners, transferir ownership (validación de que el target es miembro)
- Roles: MEMBER, ADMIN
- Invariante de 150 miembros max enforceado en el modelo
- Perfil contextual del miembro (sin bio, solo lo que hizo)

**Entregable**: podés crear un place, invitar a alguien, sumarse, multi-admin funciona.

## Fase 3 — Billing

- Feature `billing` con los tres modos
- Stripe integrado: productos, customers, subscriptions
- Stripe Connect Express para modos 2 y 3
- Flow de crear place incluye selección de billing mode
- Webhooks de Stripe para sincronizar estado
- Estados del place: `trial`, `active`, `pending_billing`, `suspended`, `archived`

**Entregable**: creás un place con cualquiera de los tres modos y las suscripciones funcionan.

## Fase 4 — Feature flags (en paralelo con Fase 3)

- `features.config.ts` como registro central
- Settings del place con toggle por feature
- El producto (portada, zonas) lee el registro y renderiza según config

**Entregable**: un place puede encender/apagar features y la UI responde.

## Fase 5 — Conversaciones

Implementar según `docs/ontologia/conversaciones.md`:

- Traer tema
- Thread individual con mensajes editoriales largos
- Citas tipo WhatsApp con borde ámbar
- Audios efímeros (15-20s, expiran a las 24h, quedan como transcripción)
- Bloque de lectores de la apertura actual
- Estados vivo/dormido (30+ días → tipografía atenuada, reactivable)
- Horario del place: composer deshabilitado fuera de horario
- Presencia viva en thread (burbujas con borde verde)

**Entregable**: feature de conversaciones completa y funcional.

## Fase 6 — Eventos

Implementar según `docs/ontologia/eventos.md`:

- Crear evento (presencial, virtual, híbrido)
- Fecha/hora con timezone awareness
- Confirmación texturada: voy / voy si puedo / no voy pero aporto / no voy
- Thread del foro auto-generado al crear evento (integración con conversations)
- Tres momentos: antes, durante, después
- Rituales con recurrencia
- Acumulación cálida sin gamificación

**Entregable**: feature de eventos completa con los tres momentos.

## Fase 7 — Portada y zonas

- Swipe horizontal entre zonas (portada + zonas por feature activa)
- Widgets en portada (miembros, discusión relevante, próximo evento)
- Onboarding overlay primera vez
- Navegación entre threads con backstack posicional
- Tema aplicado dinámicamente según config del place

**Entregable**: la experiencia del mockup viva y funcional.

## Fase 8 — Landing + onboarding

- Landing pública en `place.app`
- Flow de crear primer place con selección de billing
- Flow de aceptar invitación
- Dashboard del usuario en `app.place.app` con sus places

**Entregable**: un usuario nuevo puede llegar, crear su place, invitar, y empezar a usarlo.

---

## Lo que NO construimos en el MVP

Explícito para proteger scope. Cada cosa acá es tentación que hay que resistir:

- **Biblioteca de documentos.** Fuera del core, queda para v2.
- **DMs entre miembros.** Mencionado en la ontología pero no MVP.
- **Cursos o módulos educativos.**
- **Integración con calendario externo** (Google Calendar, Apple Calendar).
- **App móvil nativa.** Web-first. PWA opcional en v2.
- **Búsqueda full-text.** Para v2 cuando los places tengan contenido acumulado.
- **Notificaciones push.** Principio anti-FOMO. Ver `notifications.md`.
- **Temporadas/anuarios con PDF.** Feature grande, v2.
- **Moderación algorítmica.** Nunca. La moderación es humana y del admin.
- **Analytics/dashboards de uso.** El producto no mide engagement.
- **Onboarding wizard complejo.** Arranca simple: nombre, slug, billing.
- **Cambio de billing mode** después de crear el place. v2.

## Cómo evaluar cuándo pasar de MVP a v2

Pasamos a v2 cuando:

- Hay al menos 5-10 places activos usándolo regularmente
- Los feedbacks convergen en features puntuales (no 50 pedidos distintos)
- El MVP es estable, sin bugs críticos pendientes
- Tengo claridad sobre qué agregar primero basado en uso real

No antes. Resistir la tentación de agregar features durante el MVP.
