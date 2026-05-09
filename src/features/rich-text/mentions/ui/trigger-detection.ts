/**
 * Detección de slash commands (`/event`, `/library`, `/library/<cat>`) sobre
 * el texto del editor. Sin runtime React — pure function.
 *
 * Extraído de `mention-plugin.tsx` durante el split por LOC. Audit #10
 * introdujo el registry SLASH_COMMANDS; este módulo es su nueva casa.
 *
 * Ver `docs/plans/2026-05-09-split-mention-plugin.md`.
 */

/** Shape público del match. Exportado para tests del slice + consumer interno. */
export type SlashMatch = {
  trigger:
    | { kind: 'event'; query: string }
    | { kind: 'library-category'; query: string }
    | { kind: 'library-item'; categorySlug: string; query: string }
  match: { leadOffset: number; matchingString: string; replaceableString: string }
}

/**
 * Regex unificada para slash commands. Capturas:
 *   m[3] = comando (ej: "event", "library", "lib", "eve")
 *   m[4] = sub-segmento opcional después de "/" (ej: "/library/recursos" → "recursos")
 *   m[5] = query opcional después de espacio (ej: "/event hola" → "hola")
 *
 * Triggers en prefix: typear `/eve` muestra eventos, `/lib` muestra
 * categorías. Apenas el prefix es único hacia algún comando, el menú
 * aparece (no hace falta escribir el comando completo).
 *
 * `\/?` después del sub-segment: el plugin reemplaza la categoría
 * seleccionada por `/library/<slug>/` (con slash trailing como UX hint
 * de "ahora typeá para filtrar"). Sin el `\/?` la regex se rompía con
 * el slash trailing → typeahead se cerraba al instante post-selección
 * y no mostraba los items de la categoría. El `\/?` lo absorbe.
 */
export const SLASH_RE = /(^|[\s\n])(\/([a-z]+)(?:\/([\w-]+))?\/?(?:[ ]([\w-]*))?)$/

/**
 * Audit #10: registry de slash commands. Antes los nombres ("event",
 * "library") + su comportamiento estaban hardcoded en 4 branches del matcher.
 * Sumar `/poll`, `/file` o cualquier comando nuevo requería tocar 4 lugares
 * + capability flags. Con el registry: 1 entrada nueva en `SLASH_COMMANDS`
 * + 1 capability flag en `MentionPlugin`. El matcher itera y ya.
 *
 * Cada entrada describe:
 *   - `name`: nombre completo (`'event'`, `'library'`).
 *   - `acceptsSubSegment`: si `/<name>/<sub>` tiene semántica (library sí; event no).
 *   - `buildTrigger(sub, after)`: arma el `Trigger` correcto del comando.
 *
 * El behavior runtime es **idéntico** al matcher previo — los 18 tests
 * baseline en `match-slash-command.test.ts` lo garantizan.
 */
type SlashCommand = {
  name: string
  acceptsSubSegment: boolean
  buildTrigger: (sub: string, after: string) => SlashMatch['trigger']
}

const SLASH_COMMANDS: ReadonlyArray<SlashCommand> = [
  {
    name: 'event',
    acceptsSubSegment: false,
    buildTrigger: (_sub, after) => ({ kind: 'event', query: after }),
  },
  {
    name: 'library',
    acceptsSubSegment: true,
    buildTrigger: (sub, after) =>
      sub.length > 0
        ? { kind: 'library-item', categorySlug: sub, query: after }
        : { kind: 'library-category', query: '' },
  },
]

export function matchSlashCommand(text: string): SlashMatch | null {
  const m = SLASH_RE.exec(text)
  if (!m) return null
  const cmd = m[3] ?? ''
  const sub = m[4] ?? ''
  const after = m[5] ?? ''
  const replaceable = m[2] ?? ''
  const leadOffset = (m.index ?? 0) + (m[1]?.length ?? 0)
  const baseMatch = { leadOffset, matchingString: '', replaceableString: replaceable }

  // 1. Match exacto: cmd === nombre del comando registrado.
  for (const command of SLASH_COMMANDS) {
    if (cmd !== command.name) continue
    if (sub.length > 0 && !command.acceptsSubSegment) continue
    const trigger = command.buildTrigger(sub, after)
    // matchingString = la query que el typeahead usa para filtrar; relevante
    // sólo cuando el trigger tiene query (event/library-item). Para
    // library-category sin query, queda ''.
    const matchingString = 'query' in trigger ? trigger.query : ''
    return { trigger, match: { ...baseMatch, matchingString } }
  }

  // 2. Prefix match: el user está typeando el comando (ej: '/eve' → 'event').
  // Sólo aplica si NO hay sub ni after — typeando todavía el nombre.
  if (cmd.length > 0 && sub === '' && after === '') {
    for (const command of SLASH_COMMANDS) {
      if (!command.name.startsWith(cmd)) continue
      return { trigger: command.buildTrigger('', ''), match: baseMatch }
    }
  }

  return null
}
