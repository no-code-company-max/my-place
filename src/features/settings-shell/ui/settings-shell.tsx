import { Sidebar } from '@/shared/ui/sidebar/sidebar'
import { buildSettingsShellSections } from '../domain/sections'

/**
 * Composer del shell de settings desktop. Server Component que envuelve
 * el content area de `/settings/*` con el sidebar de navegación 240px
 * a la izquierda (desktop) y deja el content area con max-width centrado.
 *
 * Mobile: el sidebar está oculto via CSS (`hidden md:flex`); el FAB del
 * shell sub-slice (`<SettingsNavFab>`) cubre la navegación mobile —
 * coexisten por viewport, no se reemplazan en JS.
 *
 * Ver `docs/features/settings-shell/spec.md` § "Composer `<SettingsShell>`".
 */

type Props = {
  children: React.ReactNode
  /** Pathname server-rendered del request (vía `headers()` o segments). */
  currentPath: string
  /** Slug del place actual, para prefijar los hrefs del sidebar. */
  placeSlug: string
  /** Si el viewer es owner — para filtrar items owner-only del sidebar. */
  isOwner: boolean
}

export function SettingsShell({
  children,
  currentPath,
  placeSlug,
  isOwner,
}: Props): React.ReactNode {
  const sections = buildSettingsShellSections({ isOwner, placeSlug })

  return (
    <div className="md:flex md:gap-6">
      <Sidebar
        items={sections}
        currentPath={currentPath}
        ariaLabel="Configuración del place"
        className="hidden md:flex"
      />
      <div className="mx-auto max-w-screen-md flex-1 px-3 py-6 md:px-8 md:py-10">{children}</div>
    </div>
  )
}
