/**
 * Formatea un string `HH:MM` (24h, formato canónico del schema) a la
 * representación textual del locale del browser. En es-AR / es-ES devuelve
 * `09:00`; en en-US devuelve `09:00 AM`. Usa `Intl.DateTimeFormat(undefined, ...)`
 * para tomar el locale del runtime sin hardcodear nada.
 *
 * **Por qué existe**: el `<input type="time">` nativo renderiza según el
 * locale del browser/OS (no es overridable de forma confiable). Los chips +
 * preview que muestran las ventanas DEBEN usar el mismo locale para evitar la
 * inconsistencia visual donde el input dice "9:00 AM" y el chip dice "09:00".
 *
 * **Hydration warning**: este helper produce strings dependientes del runtime
 * (server vs client locales pueden diferir en Vercel — server suele caer a
 * en-US, client respeta el browser). El callsite debe envolver con
 * `suppressHydrationWarning` o renderear placeholder en SSR.
 *
 * Devuelve el `hhmm` raw si parsea malo (defensivo, no debería pasar porque
 * el schema Zod valida con `TIME_RE`).
 */
export function formatTime(hhmm: string): string {
  const parts = hhmm.split(':')
  if (parts.length !== 2) return hhmm
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const date = new Date(2000, 0, 1, h, m)
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
