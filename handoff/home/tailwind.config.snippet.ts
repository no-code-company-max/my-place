/**
 * Snippet to merge into your tailwind.config.ts
 * This exposes our CSS variables as Tailwind utility classes,
 * so you can use bg-surface, text-muted, rounded-card, etc.
 *
 * Add to your existing config under `theme.extend`.
 */

export const myPlaceTheme = {
  extend: {
    colors: {
      bg: 'var(--bg)',
      surface: 'var(--surface)',
      soft: 'var(--soft)',
      text: 'var(--text)',
      muted: 'var(--muted)',
      border: 'var(--border)',
      accent: 'var(--accent)',
      'accent-soft': 'var(--accent-soft)',
      dot: 'var(--dot)',
    },
    borderRadius: {
      card: 'var(--radius-card)',
    },
    spacing: {
      pad: 'var(--pad)',
    },
    fontFamily: {
      title: 'var(--title-font)',
      body: 'var(--body-font)',
      mono: 'var(--mono-font)',
    },
  },
}

/* Usage example:
 *   <div className="bg-surface rounded-card p-pad text-text">
 *     <h2 className="font-title text-2xl text-text">Hello</h2>
 *     <p className="font-body text-sm text-muted">Subtitle</p>
 *   </div>
 */
