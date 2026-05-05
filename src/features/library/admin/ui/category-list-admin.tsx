'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import type {
  ContributionPolicy,
  LibraryCategory,
  LibraryCategoryContributor,
} from '@/features/library/public'
import { ArchiveCategoryConfirm } from './archive-category-confirm'
import { contributionPolicyLabel } from './contribution-policy-label'
import {
  CategoryFormSheet,
  type GroupOption,
  type TierOption,
} from '@/features/library/wizard/public'
import { ContributorsSheet, GroupsScopeSheet } from '@/features/library/contributors/public'

type MemberOption = {
  userId: string
  displayName: string
  avatarUrl: string | null
  handle: string | null
}

type Props = {
  placeId: string
  /** Categorías activas (no archivadas) — el listado del admin. */
  categories: ReadonlyArray<LibraryCategory>
  /** Members activos del place — pasados al `<ContributorsSheet>`
   *  cuando una categoría tiene policy=DESIGNATED + al wizard read-access. */
  members: ReadonlyArray<MemberOption>
  /** PermissionGroups del place — pasados al picker inline de
   *  `<CategoryFormSheet>`, `<GroupsScopeSheet>` y wizard read-access. */
  groups: ReadonlyArray<GroupOption>
  /** Tiers del place — alimentan el step "Lectura" del wizard cuando
   *  readAccessKind=TIERS. Pasados desde el page padre. */
  tiers: ReadonlyArray<TierOption>
  /** Map de contributors por categoryId — precargado en el page. Las
   *  categorías que no figuran en el Map no tienen contributors. */
  contributorsByCategory: ReadonlyMap<string, ReadonlyArray<LibraryCategoryContributor>>
  /** Map de read scopes por categoryId — precargado en el page. */
  readScopesByCategory: ReadonlyMap<
    string,
    {
      kind: 'PUBLIC' | 'GROUPS' | 'TIERS' | 'USERS'
      groupIds: ReadonlyArray<string>
      tierIds: ReadonlyArray<string>
      userIds: ReadonlyArray<string>
    }
  >
  /** Si el place todavía tiene cupo bajo `MAX_CATEGORIES_PER_PLACE`. Cuando es
   *  false, el botón "Nueva categoría" se oculta — para crear hay que
   *  archivar alguna primero. */
  canCreateMore: boolean
}

/**
 * Estado canónico del orquestador admin. Discriminated union que cubre
 * los panels que el admin puede abrir desde la lista (form crear/editar,
 * contributors picker, groups scope picker, confirm de archivar) más el
 * estado cerrado.
 *
 * Mismo patrón que `WeekEditor` (`SheetState`) — el padre es la fuente
 * única de "qué overlay está abierto y con qué payload", y cada sheet
 * es controlled (recibe `open` + `onOpenChange` derivados del kind).
 */
type SheetState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | {
      kind: 'edit'
      categoryId: string
      initialEmoji: string
      initialTitle: string
      initialPolicy: ContributionPolicy
      initialKind: 'GENERAL' | 'COURSE'
      initialReadAccessKind: 'PUBLIC' | 'GROUPS' | 'TIERS' | 'USERS'
      initialGroupScopeIds: ReadonlyArray<string>
      initialContributorUserIds: ReadonlyArray<string>
      initialReadGroupIds: ReadonlyArray<string>
      initialReadTierIds: ReadonlyArray<string>
      initialReadUserIds: ReadonlyArray<string>
    }
  | {
      kind: 'contributors'
      categoryId: string
      categoryTitle: string
      contributors: ReadonlyArray<LibraryCategoryContributor>
    }
  | {
      kind: 'group-scope'
      categoryId: string
      categoryTitle: string
      currentGroupIds: ReadonlyArray<string>
    }
  | { kind: 'archive'; categoryId: string; categoryTitle: string }

/**
 * Listado admin de categorías. Client Component porque mantiene state
 * para los 3 overlays (form sheet, contributors sheet, archive confirm)
 * y cablea el botón "Nueva categoría" inline.
 *
 * Estructura:
 *  - Header con botón "Nueva categoría" (oculto si `canCreateMore=false`).
 *  - `<ul>` de categorías — cada row con un único dropdown trigger (`...`)
 *    cuyas acciones son Editar / Contribuidores (solo DESIGNATED) / Archivar.
 *  - Sheets/dialogs montados al final, controlled vía `sheet.kind`.
 */
export function CategoryListAdmin({
  placeId,
  categories,
  members,
  groups,
  tiers,
  contributorsByCategory,
  readScopesByCategory,
  canCreateMore,
}: Props): React.ReactNode {
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })

  function close(): void {
    setSheet({ kind: 'closed' })
  }

  // Mode estable para `<CategoryFormSheet>` — cuando el sheet no está
  // abierto en create/edit, igual hay que pasarle un `mode` válido (la
  // prop es required). Bake un valor sensible: `placeId` para create,
  // o el payload de edit si está activo. Como `open=false` en esos
  // casos, el contenido del form no se renderiza.
  const formSheetOpen = sheet.kind === 'create' || sheet.kind === 'edit'
  const formSheetMode =
    sheet.kind === 'edit'
      ? {
          kind: 'edit' as const,
          categoryId: sheet.categoryId,
          initialEmoji: sheet.initialEmoji,
          initialTitle: sheet.initialTitle,
          initialPolicy: sheet.initialPolicy,
          initialKind: sheet.initialKind,
          initialReadAccessKind: sheet.initialReadAccessKind,
          initialGroupScopeIds: sheet.initialGroupScopeIds,
          initialContributorUserIds: sheet.initialContributorUserIds,
          initialReadGroupIds: sheet.initialReadGroupIds,
          initialReadTierIds: sheet.initialReadTierIds,
          initialReadUserIds: sheet.initialReadUserIds,
        }
      : { kind: 'create' as const, placeId }

  // Mismo patrón para los otros sheets — `open` deriva del kind, los
  // demás props caen a defaults seguros cuando no es el activo.
  const contributorsOpen = sheet.kind === 'contributors'
  const contributorsCategoryId = sheet.kind === 'contributors' ? sheet.categoryId : ''
  const contributorsCategoryTitle = sheet.kind === 'contributors' ? sheet.categoryTitle : ''
  const contributorsList: ReadonlyArray<LibraryCategoryContributor> =
    sheet.kind === 'contributors' ? sheet.contributors : []

  const groupScopeOpen = sheet.kind === 'group-scope'
  const groupScopeCategoryId = sheet.kind === 'group-scope' ? sheet.categoryId : ''
  const groupScopeCategoryTitle = sheet.kind === 'group-scope' ? sheet.categoryTitle : ''
  const groupScopeCurrent: ReadonlyArray<string> =
    sheet.kind === 'group-scope' ? sheet.currentGroupIds : []

  const archiveOpen = sheet.kind === 'archive'
  const archiveCategoryId = sheet.kind === 'archive' ? sheet.categoryId : ''
  const archiveCategoryTitle = sheet.kind === 'archive' ? sheet.categoryTitle : ''

  return (
    <div className="space-y-3">
      {categories.length === 0 ? (
        <p className="text-sm italic text-neutral-500">
          Todavía no hay categorías. Creá la primera para empezar a organizar la biblioteca.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {categories.map((category) => {
            const contributors = contributorsByCategory.get(category.id) ?? []
            return (
              <li key={category.id} className="flex min-h-[56px] items-center gap-3 py-2">
                <span aria-hidden className="text-2xl leading-none">
                  {category.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-title text-base font-semibold">{category.title}</h3>
                  <p className="truncate text-xs text-neutral-600">
                    <span>/library/{category.slug}</span>
                    <span className="mx-1.5">·</span>
                    <span>{contributionPolicyLabel(category.contributionPolicy)}</span>
                    {category.contributionPolicy === 'DESIGNATED' ? (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>{contributors.length} con permiso</span>
                      </>
                    ) : null}
                    {category.contributionPolicy === 'SELECTED_GROUPS' ? (
                      <>
                        <span className="mx-1.5">·</span>
                        <span>
                          {category.groupScopeIds.length}{' '}
                          {category.groupScopeIds.length === 1 ? 'grupo' : 'grupos'}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
                      aria-label={`Opciones para ${category.title}`}
                    >
                      <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="5" r="1" />
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="12" cy="19" r="1" />
                      </svg>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onSelect={() => {
                        const readScope = readScopesByCategory.get(category.id) ?? {
                          kind: 'PUBLIC' as const,
                          groupIds: [] as string[],
                          tierIds: [] as string[],
                          userIds: [] as string[],
                        }
                        setSheet({
                          kind: 'edit',
                          categoryId: category.id,
                          initialEmoji: category.emoji,
                          initialTitle: category.title,
                          initialPolicy: category.contributionPolicy,
                          initialKind: category.kind,
                          initialReadAccessKind: category.readAccessKind,
                          initialGroupScopeIds: category.groupScopeIds,
                          initialContributorUserIds: contributors.map((c) => c.userId),
                          initialReadGroupIds: readScope.groupIds,
                          initialReadTierIds: readScope.tierIds,
                          initialReadUserIds: readScope.userIds,
                        })
                      }}
                    >
                      Editar
                    </DropdownMenuItem>
                    {category.contributionPolicy === 'DESIGNATED' ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          setSheet({
                            kind: 'contributors',
                            categoryId: category.id,
                            categoryTitle: category.title,
                            contributors,
                          })
                        }
                      >
                        Contribuidores
                      </DropdownMenuItem>
                    ) : null}
                    {category.contributionPolicy === 'SELECTED_GROUPS' ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          setSheet({
                            kind: 'group-scope',
                            categoryId: category.id,
                            categoryTitle: category.title,
                            currentGroupIds: category.groupScopeIds,
                          })
                        }
                      >
                        Grupos asignados
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                      onSelect={() =>
                        setSheet({
                          kind: 'archive',
                          categoryId: category.id,
                          categoryTitle: category.title,
                        })
                      }
                    >
                      Archivar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      )}

      {canCreateMore ? (
        <button
          type="button"
          onClick={() => setSheet({ kind: 'create' })}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 hover:border-neutral-500"
        >
          <span aria-hidden="true">+</span> Nueva categoría
        </button>
      ) : null}

      <CategoryFormSheet
        open={formSheetOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        mode={formSheetMode}
        groups={groups}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          handle: m.handle,
        }))}
        tiers={tiers}
      />

      <ContributorsSheet
        open={contributorsOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        categoryId={contributorsCategoryId}
        categoryTitle={contributorsCategoryTitle}
        initialContributors={contributorsList}
        members={members}
      />

      <GroupsScopeSheet
        open={groupScopeOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        categoryId={groupScopeCategoryId}
        categoryTitle={groupScopeCategoryTitle}
        initialGroupIds={groupScopeCurrent}
        groups={groups}
      />

      <ArchiveCategoryConfirm
        open={archiveOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        categoryId={archiveCategoryId}
        categoryTitle={archiveCategoryTitle}
      />
    </div>
  )
}
