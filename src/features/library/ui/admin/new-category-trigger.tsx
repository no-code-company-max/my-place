'use client'

import { useState } from 'react'
import {
  CategoryFormSheet,
  type GroupOption,
  type MemberOption,
  type TierOption,
} from '@/features/library/wizard/public'

type Props = {
  placeId: string
  groups: ReadonlyArray<GroupOption>
  members: ReadonlyArray<MemberOption>
  tiers: ReadonlyArray<TierOption>
}

/**
 * Trigger client-side de "+ Nueva categoría" que abre el wizard
 * `CategoryFormSheet`. Reemplaza al legacy `CategoryFormDialog`
 * (dropeado en S1b).
 *
 * Se usa desde el layout server `/settings/library/layout.tsx` que carga
 * los catalogs (groups + members + tiers) y los pasa acá.
 *
 * En S2 el wizard sumará step de write access — el trigger no cambia.
 */
export function NewCategoryTrigger({ placeId, groups, members, tiers }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 hover:border-neutral-500"
      >
        <span aria-hidden="true">+</span> Nueva categoría
      </button>
      <CategoryFormSheet
        open={open}
        onOpenChange={setOpen}
        mode={{ kind: 'create', placeId }}
        groups={groups}
        members={members}
        tiers={tiers}
      />
    </>
  )
}
