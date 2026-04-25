/**
 * Formatea `startsAt`/`endsAt` de un evento en el timezone del evento (IANA).
 *
 * Patrón distinto al `TimeAgo` de discussions: los eventos son puntos
 * absolutos en el tiempo con un timezone "intencional" (la hora del
 * evento). Mostrar siempre en la hora del evento ancla la lectura — es lo
 * que el host quiso decir cuando publicó. Si el viewer vive en otro huso,
 * la UI muestra una segunda línea "hora local: …" (gestionada por el call
 * site, no acá).
 *
 * Idioma `es-AR`. Pure function, server + client safe.
 */
export function formatEventDateTime(startsAt: Date, endsAt: Date | null, timezone: string): string {
  const dateStr = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(startsAt)

  const timeStr = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(startsAt)

  if (!endsAt) return `${capitalize(dateStr)} · ${timeStr}`

  // Si endsAt cae el mismo día calendario en el TZ del evento, mostramos
  // una sola fecha con rango horario. Si cae otro día, dos fechas.
  const endDateStr = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(endsAt)
  const startDateOnly = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: timezone,
  }).format(startsAt)
  const endTimeStr = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(endsAt)

  if (endDateStr === startDateOnly) {
    return `${capitalize(dateStr)} · ${timeStr}–${endTimeStr}`
  }
  return `${capitalize(dateStr)} ${timeStr} → ${endDateStr} ${endTimeStr}`
}

function capitalize(s: string): string {
  if (s.length === 0) return s
  return s[0]!.toUpperCase() + s.slice(1)
}

/** Label del timezone para la línea "hora del evento (IANA)". */
export function formatTimezoneLabel(timezone: string): string {
  // Heurística: tomamos la última parte del IANA y reemplazamos `_` por espacios.
  const parts = timezone.split('/')
  const last = parts[parts.length - 1] ?? timezone
  return last.replace(/_/g, ' ')
}
