import { LibraryItemRow, type LibraryItemListView } from '@/features/library/public'
import { LibraryItemLockedRow } from './library-item-locked-row'

/**
 * Lista de items dentro de una categoría tipo CURSO. Mismo layout visual
 * que `<ItemList>` (raíz, para categorías GENERAL) pero con awareness de
 * prereqs: items con prereq incompleto se renderean como
 * `<LibraryItemLockedRow>` (intercepta click → toast con CTA al prereq) en
 * lugar de `<LibraryItemRow>` plano.
 *
 * Decisión D11 ADR `2026-05-04-library-courses-and-read-access.md`:
 * **visible-but-locked**, no ocultar.
 *
 * Bypass para owner: `viewerIsOwner=true` ⇒ todos los items renderean
 * desbloqueados independiente del prereq (admin necesita ver todo el
 * itinerary sin completar nada).
 *
 * Server Component puro (`<LibraryItemLockedRow>` es Client adentro).
 */
type ItemLookupEntry = {
  title: string
  categorySlug: string
  postSlug: string
}

type Props = {
  items: ReadonlyArray<LibraryItemListView>
  /** Items que el viewer ya marcó como completados. Default vacío
   *  (rows nunca se bloquean — equivale a recién entrar al curso). */
  completedItemIds?: ReadonlyArray<string>
  /** Lookup id → metadata para resolver el prereq de cada item bloqueado.
   *  El caller arma el map con los items de la categoría (los prereqs
   *  siempre viven en la misma categoría, según la spec). */
  itemsLookup?: ReadonlyMap<string, ItemLookupEntry>
  /** Bypass total — owner ve todo sin lock. Default `false`. */
  viewerIsOwner?: boolean
}

export function CourseItemList({
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
