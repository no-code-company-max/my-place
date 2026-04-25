# Events — Sub-spec RSVP texturado

> **Alcance:** detalle del modelo RSVP — 4 estados con justificación ontológica, mapping copy, CHECK constraint sobre `note`, visibility rules en listas, transiciones permitidas. Complementa `spec.md`.

> **Referencias:** `docs/ontologia/eventos.md § Participantes` (canónico — "voy / voy si X / no voy pero aporto Y / no voy"), `spec.md § 4` (modelo de datos), `spec.md § 7` (flow rsvpEventAction).

## 1. Por qué 4 estados (no binario)

La ontología (`eventos.md § Participantes`) define cuatro respuestas posibles al RSVP:

> Confirmación texturada: voy / voy si X / no voy pero aporto Y / no voy

Razón ontológica: la respuesta a "¿venís?" en un place íntimo no es binaria. La realidad es texturada — "voy si llego del trabajo a tiempo", "no puedo ir pero llevo el postre", "no me sumo esta vez". Forzar sí/no aplana el matiz que el lugar tiene en la vida del miembro.

Las plataformas masivas usan binario porque escalan hacia el evento como producto (ticketing, asistencia agregada). Place no escala: 150 miembros máximo. La textura cabe.

**Por qué exactamente 4 (no 3, no 5)**:

- 3 estados (going / maybe / not_going) pierden el "aporto Y" — invisibiliza la presencia indirecta. Alguien que dice "no voy pero llevo el vino" está participando del evento sin asistir físicamente.
- 5+ estados invitan a multiplicar matices (going_late, going_briefly, etc.) que la ontología no pide. Sumar opciones rompe la simplicidad cozytech ("nada grita, nada demanda").
- Los 4 mapean directamente al texto de la ontología sin reinterpretar.

## 2. Estados, copy y mapping

```ts
enum RSVPState {
  GOING                    // "voy"
  GOING_CONDITIONAL        // "voy si X"   — note opcional explica el "si"
  NOT_GOING_CONTRIBUTING   // "no voy pero aporto Y" — note opcional explica el aporte
  NOT_GOING                // "no voy"
}
```

**Mapping enum → copy F1** (UI en español, `es-AR`):

| Enum                     | Label visible          | Textfield label si aplica | Placeholder textfield                                     |
| ------------------------ | ---------------------- | ------------------------- | --------------------------------------------------------- |
| `GOING`                  | "Voy"                  | —                         | —                                                         |
| `GOING_CONDITIONAL`      | "Voy si…"              | "¿Qué necesitarías?"      | "Si llego del trabajo a tiempo / si me organizo con auto" |
| `NOT_GOING_CONTRIBUTING` | "No voy, pero aporto…" | "¿Cómo aportás?"          | "Llevo el vino / mando link de Spotify / paso receta"     |
| `NOT_GOING`              | "No voy"               | —                         | —                                                         |

**`note` constraint**:

- Max 280 chars (alineado con cuerpos cortos tipo Twitter — invitación a la concisión).
- Sólo permitido en `GOING_CONDITIONAL` y `NOT_GOING_CONTRIBUTING`.
- Permitido vacío en estos 2 estados (el usuario puede elegir "voy si…" sin completar). UI sugiere completar con placeholder pero no fuerza.
- Texto en `GOING` o `NOT_GOING` rechazado por `ValidationError` (server) y CHECK constraint (DB).

### CHECK constraint a nivel DB

```sql
ALTER TABLE "EventRSVP" ADD CONSTRAINT rsvp_note_only_when_textured
  CHECK (note IS NULL OR state IN ('GOING_CONDITIONAL', 'NOT_GOING_CONTRIBUTING'));
```

Razón: defensa en profundidad. Si un bug del server salta la validación de invariants, el INSERT/UPDATE falla en DB con un mensaje claro en lugar de persistir data inconsistente.

### Invariant del dominio (en `events/domain/invariants.ts`)

```ts
export function validateRsvpNote(state: RSVPState, note: string | null): void {
  if (note === null || note === '') return // null/empty siempre OK
  if (state === 'GOING_CONDITIONAL' || state === 'NOT_GOING_CONTRIBUTING') {
    if (note.length > 280) {
      throw new ValidationError('La nota no puede superar 280 caracteres.')
    }
    return
  }
  throw new ValidationError('La nota sólo aplica si "Voy si…" o "No voy, pero aporto…".')
}
```

## 3. Transiciones permitidas

Cualquier estado a cualquier otro estado, mientras el evento no esté cancelado. Razón: la presencia se reajusta — el miembro que dijo "voy" hoy puede decir "voy si X" mañana cuando aparece un imprevisto, o pasar a "no voy pero aporto Y" si surge un compromiso conflicto.

```
                  ┌─────► GOING ◄─────┐
                  │                   │
                  ▼                   ▼
        GOING_CONDITIONAL  ◄─►  NOT_GOING_CONTRIBUTING
                  ▲                   ▲
                  │                   │
                  └─────► NOT_GOING ◄─┘
```

(Diagrama simplificado: cualquier transición está permitida en F1.)

**`rsvpEventAction` es upsert idempotente** sobre `(eventId, userId)`:

- INSERT si no existe.
- UPDATE si existe (cambia `state` y `note` simultáneamente).
- `note` se setea a NULL automáticamente si la transición lleva a un estado sin textura (server lo enforce — el cliente puede mandar el `note` viejo, el server lo descarta).

**Eliminar RSVP** (cambio explícito a "sin respuesta"): F1 NO lo soporta. Una vez que el miembro respondió algo, queda registrado. Si quiere "des-respondear", elige `NOT_GOING` (la opción más cercana semánticamente). DELETE de RSVP existe sólo via:

- Erasure 365d del ex-miembro (`runErasure`).
- Cascade del DELETE del Event (no soportado en F1 — soft-cancel).

## 4. Visibility rules en listas

Estados públicos vs privados:

| Estado                   | Visible en `RsvpList` (público al place) | Visible al viewer (su propia respuesta) |
| ------------------------ | ---------------------------------------- | --------------------------------------- |
| `GOING`                  | ✅ Sí — aparece en "Quién viene"         | ✅                                      |
| `GOING_CONDITIONAL`      | ✅ Sí — aparece en "Quién viene"         | ✅                                      |
| `NOT_GOING_CONTRIBUTING` | ❌ No — privado                          | ✅ — el viewer ve su propia decisión    |
| `NOT_GOING`              | ❌ No — privado                          | ✅                                      |

**Razón**: la ontología dice "Quién viene se ve, quién no, no se presiona". Mostrar a Maxi que Tomás dijo "no voy" expone una decisión negativa innecesariamente. La lista "quién viene" celebra presencia; el silencio sobre las ausencias respeta la intimidad.

**`note` en `GOING_CONDITIONAL`**: visible públicamente junto al avatar ("Tomás — voy si llego a tiempo"). Es presencia condicional, no decisión privada.

**`note` en `NOT_GOING_CONTRIBUTING`**: NO visible en `RsvpList`. Razón: el aporte SÍ debería ser visible al place (es presencia activa) pero el "no voy" asociado puede sentirse expuesto. F1 toma la decisión conservadora: mantener privado. Si en post-F1 emerge demanda, agregamos un widget separado "Aportes para el evento" que renderice los `note` de `NOT_GOING_CONTRIBUTING` SIN exponer el estado del autor.

**Query helper en `events/server/queries.ts`**:

```ts
export async function listEventRsvps({
  eventId,
  viewerUserId,
}: {
  eventId: string
  viewerUserId: string
}): Promise<{
  publicAttendees: Array<{
    userId: string
    state: 'GOING' | 'GOING_CONDITIONAL'
    note: string | null
  }>
  viewerOwnRsvp: EventRSVP | null
}>
```

`publicAttendees` filtra a `GOING` + `GOING_CONDITIONAL`. `viewerOwnRsvp` devuelve la RSVP del viewer si existe (cualquier estado).

## 5. Counts agregados

F1 expone:

- **"Confirmados: N"** = `count(state IN ('GOING', 'GOING_CONDITIONAL'))`. Se muestra en `EventListItem` y en `EventDetail`.
- **NO se exponen counts** de `NOT_GOING_CONTRIBUTING` ni `NOT_GOING` (ni absolutos ni agregados). Razón: información que no aporta + invita a métricas vanidosas ("32 personas no fueron"). La ontología es clara: "Sin métricas vanidosas".

## 6. Edge cases

- **Miembro nuevo se suma post-publicación del evento**: ve el evento, RSVPea normalmente. La RSVP queda asociada a su `userId`; si después deja el place, la RSVP se DELETEa por erasure (ver `spec-integrations.md § Members`).
- **Author del evento RSVPea**: permitido. Common case: el host dice "voy" (es obvio) o "voy si X" (raro pero posible). Sin tratamiento especial — es un miembro más.
- **Doble click en el botón** (race): el unique constraint `(eventId, userId)` previene doble fila. El upsert idempotente garantiza que el segundo click reemplaza al primero, no falla con `P2002`.
- **Editar `note` sin cambiar `state`**: válido. UPDATE sólo del campo `note`, mismo `state`.
- **Click "Voy" sin haber respondido antes**: INSERT directo con `note = null`.
- **Pasar de `GOING` a `GOING_CONDITIONAL` con textfield vacío**: válido. `note = null` o `''`. UI puede sugerir completar pero no bloquea.

## 7. Tests específicos de RSVP (subset de § 12 spec.md)

`actions/rsvp.test.ts`:

- 20a. Crea RSVP `GOING` sin `note` → OK.
- 20b. Crea RSVP `GOING_CONDITIONAL` con `note` → OK, persiste.
- 20c. Crea RSVP `NOT_GOING_CONTRIBUTING` con `note` → OK, persiste pero NO aparece en `publicAttendees`.
- 20d. Crea RSVP `NOT_GOING` sin `note` → OK.
- 21. Upsert: existente `GOING` → cambia a `NOT_GOING_CONTRIBUTING` con `note` → 1 fila, `note` actualizado.
- 22a. `GOING` con `note = "hola"` → `ValidationError`.
- 22b. `NOT_GOING` con `note = "hola"` → `ValidationError`.
- 22c. `GOING_CONDITIONAL` con `note` de 281 chars → `ValidationError`.
- 23. RSVP a evento con `cancelledAt` set → `ConflictError` (server) + RLS bloquea (defensa profundidad).
- 24. Doble call concurrente → 1 fila (unique constraint).

`queries.test.ts`:

- `listEventRsvps` excluye `NOT_GOING` y `NOT_GOING_CONTRIBUTING` de `publicAttendees`.
- `listEventRsvps` devuelve `viewerOwnRsvp` correcto para cualquier estado.
- `listEventRsvps` orden estable: `GOING` antes que `GOING_CONDITIONAL`, ambos por `updatedAt ASC` (los que confirmaron primero arriba).

## 8. Cambios futuros agendados (post-F1)

- **Notas en `NOT_GOING_CONTRIBUTING` visibles**: widget "Aportes" separado, sin exponer estado del autor.
- **Estado intermedio "decidiendo"**: si emerge necesidad. Hoy `GOING_CONDITIONAL` + `note` cubre el matiz.
- **Emoji reactions a la respuesta de otro** (ej: alguien pone ❤️ a "llevo el vino"): out of scope F1, podría implementarse via `Reaction` con `targetType: 'EVENT_RSVP'` (requiere extender `ContentTargetKind`).
- **Visibilidad opcional**: el author del evento podría querer ocultar la lista de confirmados ("evento sorpresa"). Hoy todos ven todos.
