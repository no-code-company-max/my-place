import { z } from 'zod'
import { DEFAULT_EDITOR_PLUGINS_CONFIG, type EditorPluginsConfig } from './types'

/**
 * Schema Zod canónico de `EditorPluginsConfig`. Estricto sobre el shape:
 * los 4 booleans son required, no admite keys extra (ningún plugin
 * fuera del catálogo MVP). Si más adelante sumamos un 5to embed, el
 * schema se actualiza acá + migration agrega default.
 */
export const editorPluginsConfigSchema = z
  .object({
    youtube: z.boolean(),
    spotify: z.boolean(),
    applePodcasts: z.boolean(),
    ivoox: z.boolean(),
  })
  .strict()

/**
 * Parser defensivo. La columna JSONB puede contener:
 *  - shape correcto → retorna tal cual.
 *  - shape parcial (rows post-migration con keys faltantes por algún
 *    update mal hecho) → mergea con `DEFAULT_EDITOR_PLUGINS_CONFIG`.
 *  - `null` / shape inválido → retorna defaults.
 *
 * No tira; producción siempre puede renderizar el composer aunque el JSON
 * esté roto. Validación estricta vive en el server action al persistir
 * (`updateEditorConfig`), no acá.
 */
export function parseEditorPluginsConfig(raw: unknown): EditorPluginsConfig {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_EDITOR_PLUGINS_CONFIG }
  }
  const obj = raw as Record<string, unknown>
  return {
    youtube: typeof obj.youtube === 'boolean' ? obj.youtube : DEFAULT_EDITOR_PLUGINS_CONFIG.youtube,
    spotify: typeof obj.spotify === 'boolean' ? obj.spotify : DEFAULT_EDITOR_PLUGINS_CONFIG.spotify,
    applePodcasts:
      typeof obj.applePodcasts === 'boolean'
        ? obj.applePodcasts
        : DEFAULT_EDITOR_PLUGINS_CONFIG.applePodcasts,
    ivoox: typeof obj.ivoox === 'boolean' ? obj.ivoox : DEFAULT_EDITOR_PLUGINS_CONFIG.ivoox,
  }
}
