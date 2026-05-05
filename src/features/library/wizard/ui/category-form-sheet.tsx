'use client'

import { useMemo } from 'react'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
} from '@/shared/ui/bottom-sheet'
import { toast } from '@/shared/ui/toaster'
import { Wizard, type WizardStep } from '@/shared/ui/wizard'
import {
  createLibraryCategoryAction,
  setLibraryCategoryDesignatedContributorsAction,
  setLibraryCategoryGroupScopeAction,
  updateLibraryCategoryAction,
  type ContributionPolicy,
  type LibraryCategoryKind,
  type LibraryReadAccessKind,
} from '@/features/library/public'
import { setLibraryCategoryReadScopeAction } from '@/features/library/access/public'
import { friendlyLibraryErrorMessage } from '@/features/library/public'
import { CategoryFormStepIdentity } from './wizard/category-form-step-identity'
import { CategoryFormStepContribution } from './wizard/category-form-step-contribution'
import { CategoryFormStepReadAccess } from './wizard/category-form-step-read-access'
import { CategoryFormStepCourse } from './wizard/category-form-step-course'
import {
  CategoryFormCatalogContext,
  type CategoryFormCatalogs,
  type CategoryFormValue,
  type GroupOption,
  type MemberOption,
  type TierOption,
} from './wizard/category-form-types'

// Re-export para que CategoryListAdmin siga importando desde acá (API
// pública estable del slice).
export type { GroupOption, MemberOption, TierOption } from './wizard/category-form-types'

type CreateMode = {
  kind: 'create'
  placeId: string
}

type EditMode = {
  kind: 'edit'
  categoryId: string
  initialEmoji: string
  initialTitle: string
  initialPolicy: ContributionPolicy
  initialKind: LibraryCategoryKind
  initialReadAccessKind: LibraryReadAccessKind
  initialGroupScopeIds: ReadonlyArray<string>
  initialContributorUserIds: ReadonlyArray<string>
  initialReadGroupIds: ReadonlyArray<string>
  initialReadTierIds: ReadonlyArray<string>
  initialReadUserIds: ReadonlyArray<string>
}

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  mode: CreateMode | EditMode
  groups: ReadonlyArray<GroupOption>
  members: ReadonlyArray<MemberOption>
  tiers: ReadonlyArray<TierOption>
}

function initialFormValueFor(mode: CreateMode | EditMode): CategoryFormValue {
  if (mode.kind === 'create') {
    return {
      emoji: '',
      title: '',
      contributionPolicy: 'MEMBERS_OPEN',
      contributionGroupIds: [],
      contributionUserIds: [],
      readAccessKind: 'PUBLIC',
      readAccessGroupIds: [],
      readAccessTierIds: [],
      readAccessUserIds: [],
      kind: 'GENERAL',
    }
  }
  return {
    emoji: mode.initialEmoji,
    title: mode.initialTitle,
    contributionPolicy: mode.initialPolicy,
    contributionGroupIds: mode.initialGroupScopeIds,
    contributionUserIds: mode.initialContributorUserIds,
    readAccessKind: mode.initialReadAccessKind,
    readAccessGroupIds: mode.initialReadGroupIds,
    readAccessTierIds: mode.initialReadTierIds,
    readAccessUserIds: mode.initialReadUserIds,
    kind: mode.initialKind,
  }
}

const STEPS: ReadonlyArray<WizardStep<CategoryFormValue>> = [
  { id: 'identity', label: 'Identidad', Component: CategoryFormStepIdentity },
  { id: 'contribution', label: 'Aporte', Component: CategoryFormStepContribution },
  { id: 'read-access', label: 'Lectura', Component: CategoryFormStepReadAccess },
  { id: 'course', label: 'Tipo', Component: CategoryFormStepCourse },
]

/**
 * BottomSheet con wizard 4-step para crear o editar una categoría
 * de library (G.5+6.b — 2026-05-04). Reemplaza el form lineal previo.
 *
 * Steps:
 *  1. Identidad — emoji (picker push interno mobile) + título.
 *  2. Aporte — contribution policy + sub-picker condicional (groups/users).
 *  3. Lectura — read access discriminator + sub-picker (groups/tiers/users).
 *  4. Tipo — toggle GENERAL/COURSE.
 *
 * Submit final atomic (decisión #D8): create/update categoría → set group
 * scope (si SELECTED_GROUPS) → set designated contributors (si DESIGNATED)
 * → set read scope (si readAccessKind ≠ PUBLIC). Si algún paso intermedio
 * post-create falla, toast con motivo + categoría queda creada (consistente
 * con patrón F.5).
 *
 * Cierre = pierde progreso (sin draft persistence) — decisión #D8.
 */
export function CategoryFormSheet({
  open,
  onOpenChange,
  mode,
  groups,
  members,
  tiers,
}: Props): React.ReactNode {
  const initialValue = useMemo(() => initialFormValueFor(mode), [mode])
  const catalogs = useMemo<CategoryFormCatalogs>(
    () => ({ groups, members, tiers }),
    [groups, members, tiers],
  )

  async function handleComplete(value: CategoryFormValue): Promise<void> {
    try {
      // Step 1: create/update + obtener categoryId.
      const targetCategoryId =
        mode.kind === 'create'
          ? (
              await createLibraryCategoryAction({
                placeId: mode.placeId,
                emoji: value.emoji,
                title: value.title.trim(),
                contributionPolicy: value.contributionPolicy,
                kind: value.kind,
              })
            ).categoryId
          : await updateLibraryCategoryAction({
              categoryId: mode.categoryId,
              emoji: value.emoji,
              title: value.title.trim(),
              contributionPolicy: value.contributionPolicy,
              kind: value.kind,
            }).then(() => mode.categoryId)

      // Step 2: persistir scope de contribución según policy.
      if (value.contributionPolicy === 'SELECTED_GROUPS') {
        const r = await setLibraryCategoryGroupScopeAction({
          categoryId: targetCategoryId,
          groupIds: [...value.contributionGroupIds],
        })
        if (!r.ok) {
          toast.error(
            'Categoría guardada pero la asignación de grupos de aporte falló. Probá desde "Grupos asignados".',
          )
          onOpenChange(false)
          return
        }
      } else if (value.contributionPolicy === 'DESIGNATED') {
        const r = await setLibraryCategoryDesignatedContributorsAction({
          categoryId: targetCategoryId,
          userIds: [...value.contributionUserIds],
        })
        if (!r.ok) {
          toast.error(
            'Categoría guardada pero la asignación de contribuidores falló. Probá desde "Contribuidores".',
          )
          onOpenChange(false)
          return
        }
      }

      // Step 3: persistir scope de lectura. Discriminated input.
      const readScopeInput =
        value.readAccessKind === 'PUBLIC'
          ? { categoryId: targetCategoryId, kind: 'PUBLIC' as const }
          : value.readAccessKind === 'GROUPS'
            ? {
                categoryId: targetCategoryId,
                kind: 'GROUPS' as const,
                groupIds: [...value.readAccessGroupIds],
              }
            : value.readAccessKind === 'TIERS'
              ? {
                  categoryId: targetCategoryId,
                  kind: 'TIERS' as const,
                  tierIds: [...value.readAccessTierIds],
                }
              : {
                  categoryId: targetCategoryId,
                  kind: 'USERS' as const,
                  userIds: [...value.readAccessUserIds],
                }
      const readResult = await setLibraryCategoryReadScopeAction(readScopeInput)
      if (!readResult.ok) {
        toast.error(
          'Categoría guardada pero la asignación de acceso de lectura falló. Probá desde el menú "Acceso de lectura".',
        )
        onOpenChange(false)
        return
      }

      toast.success(mode.kind === 'create' ? 'Categoría creada.' : 'Categoría actualizada.')
      onOpenChange(false)
    } catch (err) {
      toast.error(friendlyLibraryErrorMessage(err))
    }
  }

  const titleText = mode.kind === 'create' ? 'Nueva categoría' : 'Editar categoría'

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent aria-describedby={undefined}>
        {/* `BottomSheetTitle` y `BottomSheetDescription` requeridos por
            Radix para `aria-labelledby/describedby`. Visualmente los
            ocultamos — el wizard.Header los reemplaza con su propio
            chrome. */}
        <BottomSheetTitle className="sr-only">{titleText}</BottomSheetTitle>
        <BottomSheetDescription className="sr-only">
          Configurá la categoría en 4 pasos.
        </BottomSheetDescription>

        {open ? (
          <CategoryFormCatalogContext.Provider value={catalogs}>
            <Wizard
              steps={STEPS}
              initialValue={initialValue}
              onComplete={handleComplete}
              onClose={() => onOpenChange(false)}
            >
              <Wizard.Header />
              <Wizard.Body />
              <Wizard.Footer />
            </Wizard>
          </CategoryFormCatalogContext.Provider>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  )
}
