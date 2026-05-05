import { LibraryItemRow, type LibraryItemListView } from '@/features/library/public'
import { LibraryItemLockedRow } from '@/features/library/courses/public'

/**
 * Lista de items dentro de una categoría (R.7.10) — sub-page
 * `/library/[categorySlug]`.
 *
 * Reusa `<LibraryItemRow>` con divider hairline entre rows. Wrapper
 * con `mx-3` respeta el padding lateral 12px de la zona; los borders
 * y dividers también respetan el inset (mismo pattern que el listado
 * de discusiones tras el fix R.6.4).
 *
 * G.2+3.b (2026-05-04): si la categoría es `kind === 'COURSE'`, el caller
 * pasa `completedItemIds` (los que el viewer ya marcó) + `itemsLookup`
 * (id → metadata para resolver prereqs). Items con prereq incompleto se
 * renderizan con `<LibraryItemLockedRow>` (intercepta click → toast con
 * CTA al prereq). Decisión #D11 ADR `2026-05-04-library-courses-and-read-access.md`.
 *
 * Si `items.length === 0`, retorna null — el caller (page) usa
 * `<EmptyItemList>` en su lugar.
 *
 * Server Component puro (el child `<LibraryItemLockedRow>` es Client).
 */
type ItemLookupEntry = {
  title: string
  categorySlug: string
  postSlug: string
}

type Props = {
  items: ReadonlyArray<LibraryItemListView>
  /** Items que el viewer ya marcó como completados. Sólo aplica en
   *  categorías `kind === 'COURSE'`. Default vacío (rows nunca se
   *  bloquean). */
  completedItemIds?: ReadonlyArray<string>
  /** Lookup id → metadata para resolver el prereq de cada item bloqueado.
   *  El caller arma el map con los items de la categoría (los prereqs
   *  siempre viven en la misma categoría, según la spec). */
  itemsLookup?: ReadonlyMap<string, ItemLookupEntry>
  /** Bypass total — owner ve todo sin lock. Default `false`. */
  viewerIsOwner?: boolean
}

export function ItemList({
  items,
  completedItemIds,
  itemsLookup,
  viewerIsOwner = false,
}: Props): React.ReactNode {
  if (items.length === 0) return null
  const completedSet = new Set(completedItemIds ?? [])
  return (
    <div className="mx-3 divide-y divide-border overflow-hidden rounded-[18px] border-[0.5px] border-border bg-surface">
      {items.map((item) => {
        const prereqId = item.prereqItemId
        const blocked = !viewerIsOwner && prereqId !== null && !completedSet.has(prereqId)
        if (blocked && itemsLookup) {
          const prereq = itemsLookup.get(prereqId!)
          if (prereq) {
            return <LibraryItemLockedRow key={item.id} item={item} prereq={prereq} />
          }
        }
        return <LibraryItemRow key={item.id} item={item} />
      })}
    </div>
  )
}
