import type { CSSProperties } from 'react'

/**
 * Contract de theming por place. Ver `docs/theming.md`.
 * Los colores son runtime (CSS vars), no buildtime (Tailwind).
 *
 * F.G (2026-04-27) — extendido con tokens del design handoff (warm
 * palette, oklch surfaces, member palette, density, fonts). Los
 * `--place-*` legacy se mantienen como aliases backward-compat. Cada
 * place puede customizar TODOS los tokens vía `themeConfig`.
 *
 * Ver `docs/decisions/2026-04-27-design-handoff-rebrand.md`.
 */

/** Tupla de 8 colores fijos para el avatar palette determinístico. */
export type MemberPaletteTuple = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]

export type ThemeConfig = {
  // ── Backward-compat (place-*) — generan aliases legacy.
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

  // ── Tokens nuevos del handoff (F.G).
  surface?: string
  soft?: string
  muted?: string
  border?: string
  dot?: string
  accent?: string
  accentSoft?: string
  pad?: string
  radiusCard?: string
  titleFont?: string
  bodyFont?: string
  monoFont?: string

  // ── Member avatar palette (8 colores fijos, override per-place opcional).
  memberPalette?: MemberPaletteTuple
}

const DEFAULT_MEMBER_PALETTE: MemberPaletteTuple = [
  '#c0825b',
  '#7a8c5a',
  '#4f6b85',
  '#8b6aa3',
  '#b08a3e',
  '#8a5a2b',
  '#9a6b4e',
  '#5e7d6f',
] as const

export const DEFAULT_THEME: Required<ThemeConfig> = {
  // place-* legacy ahora apuntan a los valores warm del rebrand.
  // Nota: el visual cambia respecto al pre-F.G (near-black → warm
  // brown). Aliases preservan la nomenclatura para no romper consumers.
  bg: '#f5f1ea',
  cardBg: '#ffffff',
  cardBgSoft: '#efeae0',
  text: '#1f1d1a',
  textMedium: '#52483b',
  textSoft: '#847d72',
  textWhisper: '#aaa498',
  link: '#b5633a', // = accent
  linkUnderline: '#b5633a',
  divider: '#e2dccf',
  markBg: '#b5633a', // = accent
  markFg: '#ffffff',

  // Handoff nuevos (defaults warm).
  surface: '#ffffff',
  soft: '#efeae0',
  muted: '#847d72',
  border: '#e2dccf',
  dot: '#cfc9bd',
  accent: '#b5633a',
  // Fallback hex para color-mix() en browsers viejos. Equivalente a
  // color-mix(in srgb, #b5633a 14%, transparent).
  accentSoft: 'rgba(181, 99, 58, 0.14)',
  pad: '14px',
  radiusCard: '16px',
  // Sistema de fonts: las CSS vars del next/font (--font-fraunces,
  // --font-inter) se aplican en layout.tsx. Acá las exponemos como
  // value semántico (title/body/mono) que el design system consume.
  titleFont: "var(--font-fraunces), 'Source Serif 4', Georgia, serif",
  bodyFont: 'var(--font-inter), -apple-system, system-ui, sans-serif',
  monoFont: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  memberPalette: DEFAULT_MEMBER_PALETTE,
}

/**
 * Convierte un ThemeConfig parcial en CSS vars inyectables en `<html>`.
 * Los valores faltantes caen a DEFAULT_THEME.
 *
 * Genera tanto los tokens nuevos del handoff (`--bg`, `--surface`,
 * `--accent`, `--member-1..8`, etc.) como los aliases legacy
 * (`--place-*`) para backward-compat con componentes que aún no
 * migraron.
 */
export function buildThemeVars(config: ThemeConfig = {}): CSSProperties {
  const m = { ...DEFAULT_THEME, ...config }
  return {
    // ── place-* legacy (aliases).
    '--place-bg': m.bg,
    '--place-card-bg': m.cardBg,
    '--place-card-bg-soft': m.cardBgSoft,
    '--place-text': m.text,
    '--place-text-medium': m.textMedium,
    '--place-text-soft': m.textSoft,
    '--place-text-whisper': m.textWhisper,
    '--place-link': m.link,
    '--place-link-underline': m.linkUnderline,
    '--place-divider': m.divider,
    '--place-mark-bg': m.markBg,
    '--place-mark-fg': m.markFg,

    // ── Handoff tokens.
    '--bg': m.bg,
    '--surface': m.surface,
    '--soft': m.soft,
    '--text': m.text,
    '--muted': m.muted,
    '--border': m.border,
    '--dot': m.dot,
    '--accent': m.accent,
    '--accent-soft': m.accentSoft,
    '--pad': m.pad,
    '--radius-card': m.radiusCard,
    '--title-font': m.titleFont,
    '--body-font': m.bodyFont,
    '--mono-font': m.monoFont,

    // ── Member palette (8 colores fijos).
    '--member-1': m.memberPalette[0],
    '--member-2': m.memberPalette[1],
    '--member-3': m.memberPalette[2],
    '--member-4': m.memberPalette[3],
    '--member-5': m.memberPalette[4],
    '--member-6': m.memberPalette[5],
    '--member-7': m.memberPalette[6],
    '--member-8': m.memberPalette[7],
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
