'use client'

import { useState, useTransition } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from '@/shared/ui/toaster'
import { RowActions } from '@/shared/ui/row-actions'
import { isDomainError } from '@/shared/errors/domain-error'
import {
  archiveLibraryCategoryAction,
  friendlyLibraryErrorMessage,
  MAX_CATEGORIES_PER_PLACE,
  type LibraryCategory,
  type WriteAccessKind,
} from '@/features/library/public'
import {
  CategoryFormSheet,
  type GroupOption,
  type MemberOption,
  type TierOption,
} from '@/features/library/wizard/public'

/**
 * Panel admin de categorías de biblioteca (S3, 2026-05-13).
 *
 * Patrón canónico EditPanel + lista plana (consistente con
 * `/settings/access` y `/settings/hours`). Reemplaza al master-detail
 * deployado en S3.1.
 *
 * Estructura:
 *  - Header con count + "+ Nueva categoría" dashed-border si bajo cap.
 *  - Lista plana de rows. Cada row: emoji + título + chip write +
 *    chip read + RowActions (Editar pencil, Archivar trash destructive).
 *  - Editar abre el wizard de S2 en mode=edit, prefilled con write +
 *    read scopes desde el `scopesByCategoryId` precargado.
 *  - Archivar dispara confirm dialog (auto via RowActions destructive).
 *
 * El panel es Client Component porque mantiene state del sheet abierto.
 * El page padre es Server Component que carga categories + catalogs +
 * scopes batch.
 *
 * Decisión user 2026-05-12: items NO se gestionan desde este admin
 * (viven en zona gated `/library/[cat]/[item]`). Por eso no hay sección
 * "items" en el detail — el detail completo cabe en el wizard.
 */

type CategoryScope = {
  write: {
    kind: WriteAccessKind
    groupIds: ReadonlyArray<string>
    tierIds: ReadonlyArray<string>
    userIds: ReadonlyArray<string>
  }
  read: {
    kind: 'PUBLIC' | 'GROUPS' | 'TIERS' | 'USERS'
    groupIds: ReadonlyArray<string>
    tierIds: ReadonlyArray<string>
    userIds: ReadonlyArray<string>
  }
}

type Props = {
  placeId: string
  categories: ReadonlyArray<LibraryCategory>
  scopesByCategoryId: ReadonlyMap<string, CategoryScope>
  groups: ReadonlyArray<GroupOption>
  members: ReadonlyArray<MemberOption>
  tiers: ReadonlyArray<TierOption>
}

type SheetState = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; categoryId: string }

export function LibraryCategoriesPanel({
  placeId,
  categories,
  scopesByCategoryId,
  groups,
  members,
  tiers,
}: Props): React.ReactNode {
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })
  const [pendingArchive, startArchive] = useTransition()

  const canCreateMore = categories.length < MAX_CATEGORIES_PER_PLACE

  function close(): void {
    setSheet({ kind: 'closed' })
  }

  function handleArchive(category: LibraryCategory): void {
    startArchive(async () => {
      try {
        await archiveLibraryCategoryAction({ categoryId: category.id })
        toast.success(`Categoría "${category.title}" archivada.`)
      } catch (err) {
        toast.error(isDomainError(err) ? friendlyLibraryErrorMessage(err) : 'No se pudo archivar.')
      }
    })
  }

  const editingCategory =
    sheet.kind === 'edit' ? categories.find((c) => c.id === sheet.categoryId) : null
  const editingScope =
    sheet.kind === 'edit' ? (scopesByCategoryId.get(sheet.categoryId) ?? null) : null

  return (
    <>
      <section aria-labelledby="library-categories-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="library-categories-heading"
            className="flex-1 border-b pb-2 font-serif text-xl"
            style={{ borderColor: 'var(--border)' }}
          >
            Categorías
          </h2>
          <span className="text-xs text-neutral-600">
            {categories.length}
            {canCreateMore ? ` de ${MAX_CATEGORIES_PER_PLACE}` : ' — máximo'}
          </span>
        </div>

        {categories.length === 0 ? (
          <p className="rounded-md border border-neutral-200 bg-neutral-50 p-6 text-sm italic text-neutral-500">
            Todavía no hay categorías. Creá la primera para empezar a organizar la biblioteca.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {categories.map((c) => {
              const scope = scopesByCategoryId.get(c.id)
              return (
                <li key={c.id} className="flex min-h-[56px] flex-wrap items-center gap-2 px-3 py-3">
                  <span aria-hidden className="text-2xl leading-none">
                    {c.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-base">{c.title}</h3>
                    <p className="truncate text-xs text-neutral-600">
                      <span>/library/{c.slug}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RowActions
                      triggerLabel={`Acciones para ${c.title}`}
                      chipClassName="inline-flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-700"
                      actions={[
                        {
                          icon: <Pencil aria-hidden="true" className="h-4 w-4" />,
                          label: `Editar ${c.title}`,
                          onSelect: () => setSheet({ kind: 'edit', categoryId: c.id }),
                        },
                        {
                          icon: <Trash2 aria-hidden="true" className="h-4 w-4" />,
                          label: `Archivar ${c.title}`,
                          destructive: true,
                          confirmTitle: `¿Archivar "${c.title}"?`,
                          confirmDescription:
                            'Los items existentes se mantienen pero la categoría se oculta del listado. Reversible desde la base de datos.',
                          confirmActionLabel: 'Sí, archivar',
                          onSelect: () => handleArchive(c),
                        },
                      ]}
                    >
                      <span>{writeAccessChipLabel(scope?.write.kind ?? 'OWNER_ONLY')}</span>
                      <span aria-hidden className="text-neutral-300">
                        ·
                      </span>
                      <span>{readAccessChipLabel(scope?.read.kind ?? 'PUBLIC')}</span>
                    </RowActions>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {canCreateMore ? (
          <button
            type="button"
            onClick={() => setSheet({ kind: 'create' })}
            disabled={pendingArchive}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 hover:border-neutral-500 disabled:opacity-60"
          >
            <span aria-hidden="true">+</span> Nueva categoría
          </button>
        ) : (
          <p className="text-xs italic text-neutral-500">
            Llegaste al máximo de {MAX_CATEGORIES_PER_PLACE} categorías. Archivá alguna para crear
            otra.
          </p>
        )}
      </section>

      <CategoryFormSheet
        open={sheet.kind === 'create'}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        mode={{ kind: 'create', placeId }}
        groups={groups}
        members={members}
        tiers={tiers}
      />

      {editingCategory && editingScope ? (
        <CategoryFormSheet
          open={true}
          onOpenChange={(next) => {
            if (!next) close()
          }}
          mode={{
            kind: 'edit',
            categoryId: editingCategory.id,
            initialEmoji: editingCategory.emoji,
            initialTitle: editingCategory.title,
            initialKind: editingCategory.kind,
            initialWriteAccessKind: editingScope.write.kind,
            initialWriteGroupIds: editingScope.write.groupIds,
            initialWriteTierIds: editingScope.write.tierIds,
            initialWriteUserIds: editingScope.write.userIds,
            initialReadAccessKind: editingScope.read.kind,
            initialReadGroupIds: editingScope.read.groupIds,
            initialReadTierIds: editingScope.read.tierIds,
            initialReadUserIds: editingScope.read.userIds,
          }}
          groups={groups}
          members={members}
          tiers={tiers}
        />
      ) : null}
    </>
  )
}

function writeAccessChipLabel(kind: WriteAccessKind): string {
  switch (kind) {
    case 'OWNER_ONLY':
      return 'Escribe: owner'
    case 'GROUPS':
      return 'Escribe: grupos'
    case 'TIERS':
      return 'Escribe: tiers'
    case 'USERS':
      return 'Escribe: personas'
  }
}

function readAccessChipLabel(kind: 'PUBLIC' | 'GROUPS' | 'TIERS' | 'USERS'): string {
  switch (kind) {
    case 'PUBLIC':
      return 'Lee: todos'
    case 'GROUPS':
      return 'Lee: grupos'
    case 'TIERS':
      return 'Lee: tiers'
    case 'USERS':
      return 'Lee: personas'
  }
}
