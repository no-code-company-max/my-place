import type { CSSProperties } from 'react'

/**
 * Contract de theming por place. Ver `docs/theming.md`.
 * Los colores son runtime (CSS vars), no buildtime (Tailwind).
 */
export type ThemeConfig = {
  bg?: string
  cardBg?: string
  cardBgSoft?: string
  text?: string
  textMedium?: string
  textSoft?: string
  textWhisper?: string
  link?: string
  linkUnderline?: string
  divider?: string
  markBg?: string
  markFg?: string
}

export const DEFAULT_THEME: Required<ThemeConfig> = {
  bg: '#f7f5f1',
  cardBg: '#ffffff',
  cardBgSoft: '#f0ede7',
  text: '#1a1a1a',
  textMedium: '#4a4a4a',
  textSoft: '#7a7a7a',
  textWhisper: '#a8a8a8',
  link: '#2a4d3e',
  linkUnderline: '#2a4d3e',
  divider: '#e6e1d8',
  markBg: '#1a1a1a',
  markFg: '#f7f5f1',
}

/**
 * Convierte un ThemeConfig parcial en CSS vars inyectables en <html>.
 * Los valores faltantes caen a DEFAULT_THEME.
 */
export function buildThemeVars(config: ThemeConfig = {}): CSSProperties {
  const merged = { ...DEFAULT_THEME, ...config }
  return {
    '--place-bg': merged.bg,
    '--place-card-bg': merged.cardBg,
    '--place-card-bg-soft': merged.cardBgSoft,
    '--place-text': merged.text,
    '--place-text-medium': merged.textMedium,
    '--place-text-soft': merged.textSoft,
    '--place-text-whisper': merged.textWhisper,
    '--place-link': merged.link,
    '--place-link-underline': merged.linkUnderline,
    '--place-divider': merged.divider,
    '--place-mark-bg': merged.markBg,
    '--place-mark-fg': merged.markFg,
  } as CSSProperties
}

/**
 * Valida contraste WCAG AA entre fondo y texto. Ver `docs/theming.md` § "Validación de contraste".
 * TODO(Fase 7): implementar cálculo de contrast ratio real y rechazar combinaciones < 4.5:1.
 * Por ahora solo devuelve ok=true para no bloquear dev.
 */
export function validateThemeContrast(
  _config: ThemeConfig,
): { ok: true } | { ok: false; reason: string } {
  return { ok: true }
}
