import { BackLink } from '@/shared/ui/back-button'

/**
 * Header bar sticky del item detail (R.7.9).
 *
 * Análogo a `<ThreadHeaderBar>` de discussions pero específico para
 * library: el back button **siempre** navega a la categoría
 * (`/library/[categorySlug]`), nunca usa `router.back()`.
 *
 * Razón: el item es accesible vía 2 caminos:
 *  1. `/library/[cat]/[itemSlug]` (canónica).
 *  2. `/conversations/[itemSlug]` → redirect 308 a la canónica.
 *
 * Si usáramos `router.back()` (como `<ThreadHeaderBar>`), el back
 * desde un item al que se llegó por redirect 308 vuelve a
 * `/conversations/[slug]`, que dispara el redirect 308 otra vez →
 * loop. Y si el user llega por deep link, queremos que back vaya a
 * la categoría (su contexto natural), no a discusiones.
 *
 * Por eso usamos `<BackLink>` (server, navegación directa) en lugar
 * de `<BackButton>` (client, con `router.back()` history-aware).
 *
 * Ver `docs/features/library/spec.md` § 13.
 */
type Props = {
  categorySlug: string
  /** Acciones contextuales (ItemAdminMenu) en el slot derecho. */
  rightSlot?: React.ReactNode
}

export function LibraryItemHeaderBar({ categorySlug, rightSlot }: Props): React.ReactNode {
  return (
    <div className="bg-bg/80 supports-[backdrop-filter]:bg-bg/70 sticky top-0 z-20 flex h-14 items-center justify-between gap-2 px-3 backdrop-blur">
      <BackLink href={`/library/${categorySlug}`} label="Volver a la categoría" />
      <div className="flex items-center gap-1">{rightSlot}</div>
    </div>
  )
}
