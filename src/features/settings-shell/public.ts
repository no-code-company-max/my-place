/**
 * API pública del slice `settings-shell`.
 *
 * Slice puro UI: no expone queries propias. Compone el primitive
 * `<Sidebar>` (de `@/shared/ui/sidebar/`) con la data específica de
 * settings (`SETTINGS_SECTIONS` del shell sub-slice + grouping + icons).
 *
 * Consumers: `app/[placeSlug]/settings/layout.tsx` (sidebar shell) y
 * `app/[placeSlug]/settings/page.tsx` (mobile hub root). Sub-sesión 1c
 * del plan settings desktop redesign integra ambos.
 *
 * Ver `docs/features/settings-shell/spec.md`.
 */

export { SettingsShell } from './ui/settings-shell'
export { SettingsMobileHub } from './ui/settings-mobile-hub'
export { buildSettingsShellSections } from './domain/sections'
