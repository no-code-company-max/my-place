'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from '@/shared/ui/bottom-sheet'
import { toast } from '@/shared/ui/toaster'
import {
  GROUP_DESCRIPTION_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
} from '@/features/groups/domain/invariants'
import { isLibraryScopedPermission, type Permission } from '@/features/groups/domain/permissions'
import { createGroupAction, updateGroupAction } from '@/features/groups/public'
import { CategoryScopeSelector } from '@/features/groups/category-scope/public'
import { friendlyGroupErrorMessage } from '@/features/groups/ui/errors'
import { PermissionCheckboxList } from '@/features/groups/ui/permission-checkbox-list'

type CategoryOption = {
  id: string
  emoji: string
  title: string
}

type CreateMode = {
  kind: 'create'
  placeSlug: string
}

type EditMode = {
  kind: 'edit'
  groupId: string
  initialName: string
  initialDescription: string | null
  initialPermissions: ReadonlyArray<Permission>
  initialCategoryScopeIds: ReadonlyArray<string>
  /**
   * Si `true`, el grupo es el preset "Administradores": el form bloquea
   * cambios a permisos y scope (UI los muestra disabled), permite cambios
   * a name y description.
   */
  isPreset: boolean
}

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  mode: CreateMode | EditMode
  categories: ReadonlyArray<CategoryOption>
}

/**
 * BottomSheet con form para crear o editar un grupo de permisos.
 *
 * API totalmente controlada: el padre maneja `open` + `onOpenChange` +
 * `mode`. Sigue el patrón canónico de `<CategoryFormSheet>` del slice
 * `library` (`docs/ux-patterns.md` → "BottomSheet for add / edit forms").
 *
 * Submit dispara `createGroupAction` o `updateGroupAction` según modo.
 * Pending state via `useTransition`. Toast por outcome (Sonner).
 *
 * Si modo edit + preset: permissions y scope se muestran disabled con
 * hint "El preset Administradores tiene todos los permisos por defecto."
 *
 * Touch targets: inputs `min-h-[44px] text-base` (16px → evita iOS
 * auto-zoom al focusar). Submit `min-h-12`, cancel `min-h-11`.
 */
export function GroupFormSheet({ open, onOpenChange, mode, categories }: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()

  const initialName = mode.kind === 'create' ? '' : mode.initialName
  const initialDescription = mode.kind === 'create' ? '' : (mode.initialDescription ?? '')
  const initialPermissions = mode.kind === 'create' ? [] : [...mode.initialPermissions]
  const initialScope = mode.kind === 'create' ? [] : [...mode.initialCategoryScopeIds]
  const isPreset = mode.kind === 'edit' && mode.isPreset

  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [permissions, setPermissions] = useState<Permission[]>(initialPermissions)
  const [scopeIds, setScopeIds] = useState<string[]>(initialScope)

  // Reset al abrir el sheet — sin esto, abrir en `edit` después de un
  // `create` (o viceversa) muestra los valores del modo previo. Mismo
  // patrón que `CategoryFormSheet`.
  useEffect(() => {
    if (open) {
      setName(initialName)
      setDescription(initialDescription)
      setPermissions(initialPermissions)
      setScopeIds(initialScope)
    }
    // `mode` es estable durante una apertura — el padre sólo lo cambia
    // mientras `open=false`. Listamos `open` como dep principal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const hasLibraryPermission = permissions.some(isLibraryScopedPermission)

  function handleCreateSubmit(): void {
    if (mode.kind !== 'create') return
    startTransition(async () => {
      try {
        const result = await createGroupAction({
          placeSlug: mode.placeSlug,
          name,
          description: description.trim().length > 0 ? description : undefined,
          permissions,
          categoryScopeIds: hasLibraryPermission ? scopeIds : [],
        })
        if (!result.ok) {
          if (result.error === 'group_name_taken') {
            toast.error('Ya existe un grupo con ese nombre en el place.')
          } else if (result.error === 'permission_invalid') {
            toast.error('Algún permiso es inválido. Refrescá la page.')
          }
          return
        }
        toast.success('Grupo creado.')
        onOpenChange(false)
      } catch (err) {
        toast.error(friendlyGroupErrorMessage(err))
      }
    })
  }

  function handleUpdateSubmit(): void {
    if (mode.kind !== 'edit') return
    startTransition(async () => {
      try {
        const result = await updateGroupAction({
          groupId: mode.groupId,
          name,
          description: description.trim().length > 0 ? description : undefined,
          permissions,
          categoryScopeIds: hasLibraryPermission ? scopeIds : [],
        })
        if (!result.ok) {
          if (result.error === 'group_name_taken') {
            toast.error('Ya existe un grupo con ese nombre.')
          } else if (result.error === 'permission_invalid') {
            toast.error('Algún permiso es inválido. Refrescá la page.')
          } else if (result.error === 'cannot_modify_preset') {
            toast.error('El preset Administradores no se puede modificar.')
          }
          return
        }
        toast.success('Grupo actualizado.')
        onOpenChange(false)
      } catch (err) {
        toast.error(friendlyGroupErrorMessage(err))
      }
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (name.trim().length === 0) {
      toast.error('Pone un nombre al grupo.')
      return
    }
    if (mode.kind === 'create') {
      handleCreateSubmit()
    } else {
      handleUpdateSubmit()
    }
  }

  const titleText = mode.kind === 'create' ? 'Nuevo grupo' : 'Editar grupo'
  const descriptionText =
    mode.kind === 'create'
      ? 'Definí un grupo con permisos atómicos. Asigná miembros después de crearlo.'
      : isPreset
        ? 'Editá nombre y descripción. Los permisos del preset no se pueden modificar.'
        : 'Modificá nombre, descripción, permisos y scope.'
  const submitText =
    mode.kind === 'create'
      ? pending
        ? 'Creando…'
        : 'Crear grupo'
      : pending
        ? 'Guardando…'
        : 'Guardar cambios'

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent aria-describedby={undefined}>
        <BottomSheetHeader>
          <BottomSheetTitle>{titleText}</BottomSheetTitle>
          <BottomSheetDescription>{descriptionText}</BottomSheetDescription>
        </BottomSheetHeader>

        <form onSubmit={handleSubmit} noValidate>
          <BottomSheetBody>
            <div className="space-y-4 py-2">
              <label className="block">
                <span className="mb-1 block text-sm text-neutral-600">Nombre</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={GROUP_NAME_MAX_LENGTH}
                  disabled={pending}
                  placeholder="Moderadores, Recruiters, Library Mods…"
                  className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-neutral-600">Descripción (opcional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                  rows={2}
                  disabled={pending}
                  placeholder="Qué hace este grupo."
                  className="block min-h-[60px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                />
              </label>

              <div>
                <span className="mb-1 block text-sm text-neutral-600">Permisos</span>
                <PermissionCheckboxList
                  value={permissions}
                  onChange={setPermissions}
                  disabled={pending || isPreset}
                />
                {isPreset && (
                  <p className="mt-1 text-xs text-neutral-600">
                    El preset Administradores tiene todos los permisos por defecto.
                  </p>
                )}
              </div>

              <div>
                <span className="mb-1 block text-sm text-neutral-600">Scope de biblioteca</span>
                <CategoryScopeSelector
                  value={scopeIds}
                  categories={categories}
                  onChange={setScopeIds}
                  enabled={hasLibraryPermission && !isPreset}
                />
              </div>
            </div>
          </BottomSheetBody>

          <BottomSheetFooter>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitText}
            </button>
            <BottomSheetClose asChild>
              <button
                type="button"
                disabled={pending}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm disabled:opacity-60"
              >
                Cancelar
              </button>
            </BottomSheetClose>
          </BottomSheetFooter>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}
