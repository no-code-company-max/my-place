/**
 * Tipos del slice `editor-config`. Define qué plugins de embed el composer
 * del slice `rich-text` puede ofrecer al usuario al crear contenido en el
 * place.
 *
 * No incluye plugins core (link, mention, list, heading) — esos son siempre
 * activos por surface y se controlan en `BaseComposer`. Los flags acá viven
 * sólo para los 4 embeds DecoratorNode (F.4).
 *
 * Ver `docs/features/rich-text/spec.md` § "Feature flags por place".
 */

export type EditorPluginsConfig = {
  youtube: boolean
  spotify: boolean
  applePodcasts: boolean
  ivoox: boolean
}

/**
 * Default que el migration usa como `DEFAULT` de la columna y que
 * `parseEditorPluginsConfig` aplica defensivamente cuando la fila tiene
 * shape antiguo o keys faltantes. Open by default — un place nuevo estrena
 * los 4 embeds disponibles.
 */
export const DEFAULT_EDITOR_PLUGINS_CONFIG: EditorPluginsConfig = {
  youtube: true,
  spotify: true,
  applePodcasts: true,
  ivoox: true,
}
