// Parallel Routes slot necesita import relativo al `_group-detail-content.tsx`
// colocado al hermano en la carpeta del feature route. No hay alias para `app/`
// (es un dir de routing, no una feature). Excepción documentada.
// eslint-disable-next-line no-restricted-syntax
import { GroupDetailContent } from '../../_group-detail-content'

type Props = {
  params: Promise<{ placeSlug: string; groupId: string }>
}

/**
 * Slot `@detail` de Parallel Routes para `/settings/groups/[groupId]`.
 *
 * Renderea el detail content del grupo dentro del split view del layout
 * master-detail. Reusa `<GroupDetailContent>` (mismo gate, mismas queries,
 * mismo render) que el page mobile/standalone, con `showBackLink={false}`
 * porque la lista master ya está visible al lado en desktop — un "← Volver"
 * sería ruido visual.
 *
 * En mobile, este slot está OCULTO via CSS del MasterDetailLayout cuando
 * `hasDetail=true` significaría mostrar el detail full screen, pero como
 * el routing /settings/groups/[groupId] también activa el page de mobile
 * full ([groupId]/page.tsx), el detail "real" mobile usa esa ruta y este
 * slot no se renderea.
 *
 * Ver `docs/plans/2026-05-10-settings-desktop-redesign.md` § "Sesión 3".
 */
export default async function GroupsDetailSlot({ params }: Props) {
  const { placeSlug, groupId } = await params
  return <GroupDetailContent placeSlug={placeSlug} groupId={groupId} showBackLink={false} />
}
