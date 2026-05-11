import { headers } from 'next/headers'
import { MasterDetailLayout } from '@/shared/ui/master-detail-layout'

/**
 * Layout master-detail de `/settings/groups/*` con Parallel Routes (Next 15).
 *
 * Estructura:
 * - `master` slot = `{children}` (el `page.tsx` con la lista de grupos).
 * - `detail` slot = `{detail}` (Parallel Route `@detail/`):
 *   - `@detail/default.tsx` cuando no hay grupo seleccionado.
 *   - `@detail/[groupId]/page.tsx` cuando hay un grupo seleccionado en el URL.
 *
 * Mobile (`< md`): el `<MasterDetailLayout>` muestra solo UN pane según
 * `hasDetail` (derivado del pathname `/settings/groups/[groupId]`).
 * Desktop: split view 360px lista + content pane detail siempre visibles.
 *
 * `hasDetail` se deriva del header `x-pathname` que setea el middleware
 * (server-rendered, sin `usePathname()` client). Pattern matching:
 * `/settings/groups` → false, `/settings/groups/[groupId]` → true.
 *
 * Ver `docs/plans/2026-05-10-settings-desktop-redesign.md` § "Sesión 3" y
 * `docs/research/2026-05-10-settings-desktop-ux-research.md` § 4.
 */

type Props = {
  children: React.ReactNode
  detail: React.ReactNode
}

export default async function GroupsMasterDetailLayout({ children, detail }: Props) {
  const headerStore = await headers()
  const pathname = headerStore.get('x-pathname') ?? ''
  // hasDetail = true cuando estamos en /settings/groups/[groupId] (no en root)
  const hasDetail = /^\/settings\/groups\/[^/]+/.test(pathname)

  return (
    <MasterDetailLayout
      master={children}
      detail={detail}
      hasDetail={hasDetail}
      masterLabel="Lista de grupos"
      detailLabel="Detalle del grupo"
    />
  )
}
