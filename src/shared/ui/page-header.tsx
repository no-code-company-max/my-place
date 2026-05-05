import type { ReactNode } from 'react'

/**
 * Page header consistente para settings + member detail + similares. Resuelve
 * el problema histórico de breadcrumbs/contexto redundante (ej: `Settings · The
 * Company`) que repite información que el URL + el shell (TopBar +
 * SettingsNavFab) ya proveen.
 *
 * Composición:
 *  - `title` (h1): obligatorio. `font-serif text-2xl md:text-3xl`.
 *  - `description` (text): opcional. 1-line ideal, max 2 lines en mobile.
 *  - `actions`: slot opcional para botones (ej: "Nuevo grupo", "Limpiar
 *    filtros") — alineados a la derecha en desktop, debajo en mobile.
 *
 * NO incluye:
 *  - Breadcrumbs (el URL + el FAB de navegación cubren context).
 *  - Botón "back" (cada page que necesite back importa `<BackButton>` aparte).
 *  - Logo del place / título del shell ("Settings · The Company") — ya está en
 *    el `<title>` HTML y en el shell chrome. Repetirlo es ruido.
 *
 * Layout: stack vertical mobile (title → desc → actions), row en `md:`
 * (title+desc a la izquierda, actions a la derecha). Sigue el patrón de
 * spacing del ADR `2026-05-03-mobile-first-page-padding.md`:
 * mb-6 al body de la page para gap consistente.
 */

type Props = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Optional id para que el page lo referencie con aria-labelledby si necesita. */
  id?: string
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  id,
  className = '',
}: Props): React.ReactNode {
  return (
    <header
      className={`mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h1
          id={id}
          className="font-serif text-2xl leading-tight md:text-3xl"
          style={{ color: 'var(--text)' }}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
