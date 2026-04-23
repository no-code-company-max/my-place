# Realtime: solo donde suma

Place usa Supabase Realtime de forma acotada. Esta decisión es ontológica, no técnica: el producto no compite por atención, entonces el realtime está limitado a donde realmente aporta al lugar.

## Dónde SÍ usamos realtime

- **Presencia dentro de un thread**: quién está leyendo o escribiendo ese thread ahora. Se refleja como burbujas con borde verde.
- **Mensajes nuevos en un thread abierto**: cuando alguien escribe, aparece el mensaje sin refrescar para quienes están en ese thread.

Eso es todo.

## Dónde NO usamos realtime

- Notificaciones push entre places
- Indicadores de "hay contenido nuevo" en otra zona del place
- Feed-style updates globales
- Contadores en tiempo real (nuevos mensajes totales, nuevos miembros, etc)
- Actualizaciones de RSVPs a un evento (se leen al entrar al evento)
- Cambios en la biblioteca o documentos
- Presencia en la portada del place (se refresca al entrar, no en vivo)

## Por qué esta limitación

Realtime omnipresente genera ansiedad. El producto está diseñado para que entres, te pongas al día y salgas. Saber que "acaba de entrar X" o "acaba de escribir Y en otra zona" rompe ese contrato.

Dentro de un thread activo, realtime es natural — estás en esa conversación ahora, tiene sentido que veas lo que pasa. Fuera de ese contexto, no.

## Implementación

Realtime vive como módulo shared en `src/shared/lib/realtime/` — expone primitivos
transport-agnostic (`BroadcastSender`, `BroadcastSubscriber`) sin conocer dominio.
Las features (hoy `discussions`, futuro DM / chat / eventos) construyen sus propias
convenciones de topic (`post:<id>`, `dm:<convId>`, etc.). Ver
`docs/decisions/2026-04-21-shared-realtime-module.md`.

**Subscribe (cliente)**: WebSocket long-lived via `supabase.channel()`. Se abre
cuando el cliente entra a un thread; cleanup via `Unsubscribe` retornado por el
hook al unmount.

**Send (server)**: HTTP one-shot contra `POST /realtime/v1/api/broadcast` con el
JWT del actor (no WS). Emisión ~50ms, sin handshake. Best-effort: errores se
logean y tragan — `revalidatePath` es la fuente autoritaria.

```typescript
// Client-side (hook)
const subscriber = new SupabaseBroadcastSubscriber(createSupabaseBrowser())
const unsubscribe = subscriber.subscribe<{ comment: CommentView }>(
  `post:${postId}`,
  'comment_created',
  (payload) => {
    /* dedupe + append */
  },
)
// cleanup: unsubscribe()
```

```typescript
// Server-side (action post-commit, best-effort)
await broadcastNewComment(postId, { comment: view })
// interno: getBroadcastSender().send('post:<id>', 'comment_created', payload)
```

## Fallback sin realtime

Si la conexión WebSocket falla o está bloqueada (firewalls corporativos, conexiones inestables), el thread sigue funcionando en modo no-realtime:

- Los mensajes se ven al refrescar manual
- La presencia no se actualiza
- Pero la funcionalidad básica (leer y escribir) no se rompe

El producto no debe depender duramente del realtime para ser usable.
