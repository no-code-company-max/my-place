'use client'

import { useEffect } from 'react'
import {
  CONTRIBUTION_POLICY_VALUES,
  contributionPolicyDescription,
  contributionPolicyLabel,
  type ContributionPolicy,
} from '@/features/library/public'
import type { WizardStepProps } from '@/shared/ui/wizard'
import { useCategoryFormCatalogs, type CategoryFormValue } from './category-form-types'

/**
 * Step 2: acceso de aportación (quién puede crear contenido).
 *
 * Discriminator: DESIGNATED / MEMBERS_OPEN / SELECTED_GROUPS. Sub-picker
 * inline cuando policy ≠ MEMBERS_OPEN. Owner siempre puede crear (decisión
 * #C ADR), independiente de la policy.
 *
 * Validación: siempre válido (la policy default es MEMBERS_OPEN, set picker
 * vacío es OK = "default cerrado" por design — el owner sigue creando).
 */
export function CategoryFormStepContribution({
  value,
  onChange,
  onValid,
}: WizardStepProps<CategoryFormValue>): React.ReactNode {
  const { groups, members } = useCategoryFormCatalogs()

  useEffect(() => {
    onValid(true)
  }, [onValid])

  const sortedGroups = [...groups].sort((a, b) => {
    if (a.isPreset && !b.isPreset) return -1
    if (!a.isPreset && b.isPreset) return 1
    return a.name.localeCompare(b.name)
  })
  const sortedMembers = [...members].sort((a, b) => a.displayName.localeCompare(b.displayName))

  const groupSet = new Set(value.contributionGroupIds)
  const userSet = new Set(value.contributionUserIds)

  function setPolicy(next: ContributionPolicy): void {
    onChange({ ...value, contributionPolicy: next })
  }

  function toggleGroup(id: string): void {
    const nextSet = new Set(groupSet)
    if (nextSet.has(id)) nextSet.delete(id)
    else nextSet.add(id)
    onChange({ ...value, contributionGroupIds: Array.from(nextSet) })
  }

  function toggleUser(id: string): void {
    const nextSet = new Set(userSet)
    if (nextSet.has(id)) nextSet.delete(id)
    else nextSet.add(id)
    onChange({ ...value, contributionUserIds: Array.from(nextSet) })
  }

  return (
    <div className="space-y-4 py-2">
      <label className="block">
        <span className="mb-1 block text-sm text-neutral-600">Quién puede agregar contenido</span>
        <select
          value={value.contributionPolicy}
          onChange={(e) => setPolicy(e.target.value as ContributionPolicy)}
          className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
        >
          {CONTRIBUTION_POLICY_VALUES.map((p) => (
            <option key={p} value={p}>
              {contributionPolicyLabel(p)}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-neutral-600">
          {contributionPolicyDescription(value.contributionPolicy)}
        </span>
      </label>

      {value.contributionPolicy === 'SELECTED_GROUPS' ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 block text-sm text-neutral-600">
            Grupos con permiso ({groupSet.size} seleccionados)
          </legend>
          {sortedGroups.length === 0 ? (
            <p className="text-sm italic text-neutral-500">
              Este place no tiene grupos creados todavía.
            </p>
          ) : (
            <div className="divide-y divide-neutral-200 border-y border-neutral-200">
              {sortedGroups.map((g) => {
                const checked = groupSet.has(g.id)
                return (
                  <label
                    key={g.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(g.id)}
                      className="h-4 w-4"
                    />
                    <span className="flex-1 text-sm">
                      {g.name}
                      {g.isPreset ? (
                        <span className="ml-2 rounded-full border border-amber-300 px-2 py-0.5 text-[11px] text-amber-700">
                          preset
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>
      ) : null}

      {value.contributionPolicy === 'DESIGNATED' ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 block text-sm text-neutral-600">
            Personas con permiso ({userSet.size} seleccionadas)
          </legend>
          {sortedMembers.length === 0 ? (
            <p className="text-sm italic text-neutral-500">
              Este place no tiene miembros activos todavía.
            </p>
          ) : (
            <div className="divide-y divide-neutral-200 border-y border-neutral-200">
              {sortedMembers.map((m) => {
                const checked = userSet.has(m.userId)
                return (
                  <label
                    key={m.userId}
                    className="flex min-h-11 cursor-pointer items-center gap-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUser(m.userId)}
                      className="h-4 w-4"
                    />
                    <span className="flex-1 text-sm">
                      {m.displayName}
                      {m.handle ? (
                        <span className="ml-2 text-xs text-neutral-500">@{m.handle}</span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>
      ) : null}
    </div>
  )
}
