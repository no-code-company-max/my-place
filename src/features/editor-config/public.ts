/**
 * API pública client-safe del slice `editor-config`. Tipos puros, schema
 * Zod, server action (callable desde Client Components) y componente UI
 * del form de toggles.
 *
 * **No** incluye queries server-only — viven en `public.server.ts`.
 *
 * Pattern canónico: `docs/decisions/2026-04-21-flags-subslice-split.md`
 * § "Boundary client vs server".
 */

export type { EditorPluginsConfig } from './domain/types'
export { DEFAULT_EDITOR_PLUGINS_CONFIG } from './domain/types'
export { editorPluginsConfigSchema, parseEditorPluginsConfig } from './domain/schemas'
export {
  updateEditorConfigAction,
  type UpdateEditorConfigInput,
  type UpdateEditorConfigResult,
} from './server/actions'
export { EditorConfigForm } from './ui/editor-config-form'
