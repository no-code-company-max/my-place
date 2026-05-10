import type { ReactNode } from 'react'

/**
 * Tipos del primitive `<Sidebar>` agnóstico al dominio.
 *
 * Ver `docs/features/settings-shell/spec.md` § "API del primitive `<Sidebar>`".
 */

export type SidebarItem = {
  /** Path absoluto del link (ej. `/the-company/settings/hours`). */
  href: string
  /** Texto visible del item. */
  label: string
  /** Icono opcional (típicamente de `lucide-react`). */
  icon?: ReactNode
}

export type SidebarGroup = {
  /** Identificador estable del grupo (key de React + posible target de scroll). */
  id: string
  /**
   * Si está, renderea un `<h3>` con este label uppercase arriba del grupo.
   * Si undefined, los items del grupo se renderean sin header (caso "ungrouped").
   */
  label?: string
  items: SidebarItem[]
}

/**
 * Array ordenado de groups. Cada uno con sus items. El orden se respeta tal cual
 * en el render (no hay reordering automático).
 */
export type SidebarSections = SidebarGroup[]
