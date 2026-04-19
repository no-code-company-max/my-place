import type { Config } from 'tailwindcss'

/**
 * Tailwind solo para layout/spacing/typography.
 * Los colores del place viven como CSS variables (ver `docs/theming.md`),
 * no como clases `bg-*` hardcoded.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Tipografía NO customizable por place (ver theming.md § "Lo que NO es configurable").
        serif: ['var(--font-fraunces)', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Aliases que referencian CSS vars del place. Uso: `bg-place`, `text-place`, etc.
        place: 'var(--place-bg)',
        'place-card': 'var(--place-card-bg)',
        'place-card-soft': 'var(--place-card-bg-soft)',
        'place-text': 'var(--place-text)',
        'place-text-medium': 'var(--place-text-medium)',
        'place-text-soft': 'var(--place-text-soft)',
        'place-text-whisper': 'var(--place-text-whisper)',
        'place-link': 'var(--place-link)',
        'place-link-underline': 'var(--place-link-underline)',
        'place-divider': 'var(--place-divider)',
        'place-mark-bg': 'var(--place-mark-bg)',
        'place-mark-fg': 'var(--place-mark-fg)',
      },
    },
  },
  plugins: [],
}

export default config
