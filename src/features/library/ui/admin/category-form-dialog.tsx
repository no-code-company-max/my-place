'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { toast } from '@/shared/ui/toaster'
import {
  CATEGORY_EMOJI_MAX_LENGTH,
  CATEGORY_TITLE_MAX_LENGTH,
  CONTRIBUTION_POLICY_VALUES,
  type ContributionPolicy,
  createLibraryCategoryAction,
  updateLibraryCategoryAction,
} from '@/features/library/public'
import { friendlyLibraryErrorMessage } from './errors'
import { contributionPolicyDescription, contributionPolicyLabel } from './contribution-policy-label'

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
}

type Props = {
  mode: CreateMode | EditMode
  /** Render del trigger — puede ser un botón "Nueva categoría" o un
   *  ítem de menú en el row admin. El componente se encarga del state
   *  open/close internamente. */
  trigger: React.ReactNode
}

type FormValues = {
  emoji: string
  title: string
  contributionPolicy: ContributionPolicy
}

/**
 * Modal con form para crear o editar una categoría de biblioteca.
 *
 * Reusa `<Dialog>` shared (Radix + estética del place) + `useForm` de
 * react-hook-form. Submit dispara `createLibraryCategoryAction` o
 * `updateLibraryCategoryAction` según el modo.
 *
 * Toast de éxito/error vía Sonner (`@/shared/ui/toaster`). El page padre
 * revalida `/settings/library` desde la action — el listado actualiza
 * automáticamente sin que este componente toque router state.
 *
 * Slug NO se edita — inmutable post-create (decisión spec § 11). En modo
 * edit, el slug del row se muestra read-only debajo del título como hint
 * pero no entra al form.
 */
export function CategoryFormDialog({ mode, trigger }: Props): React.ReactNode {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const initialValues: FormValues =
    mode.kind === 'create'
      ? { emoji: '', title: '', contributionPolicy: 'MEMBERS_OPEN' }
      : {
          emoji: mode.initialEmoji,
          title: mode.initialTitle,
          contributionPolicy: mode.initialPolicy,
        }

  const { register, handleSubmit, watch, reset, formState } = useForm<FormValues>({
    defaultValues: initialValues,
  })

  const policy = watch('contributionPolicy')

  function onSubmit(values: FormValues): void {
    startTransition(async () => {
      try {
        if (mode.kind === 'create') {
          await createLibraryCategoryAction({
            placeId: mode.placeId,
            emoji: values.emoji,
            title: values.title,
            contributionPolicy: values.contributionPolicy,
          })
          toast.success('Categoría creada.')
        } else {
          await updateLibraryCategoryAction({
            categoryId: mode.categoryId,
            emoji: values.emoji,
            title: values.title,
            contributionPolicy: values.contributionPolicy,
          })
          toast.success('Categoría actualizada.')
        }
        setOpen(false)
        reset(initialValues)
      } catch (err) {
        toast.error(friendlyLibraryErrorMessage(err))
      }
    })
  }

  const titleText = mode.kind === 'create' ? 'Nueva categoría' : 'Editar categoría'
  const submitText =
    mode.kind === 'create'
      ? pending
        ? 'Creando…'
        : 'Crear categoría'
      : pending
        ? 'Guardando…'
        : 'Guardar cambios'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="contents"
        aria-label={titleText}
      >
        {trigger}
      </button>
      <DialogContent>
        <DialogTitle>{titleText}</DialogTitle>
        <DialogDescription>
          {mode.kind === 'create'
            ? 'Agregá un agrupador para organizar los recursos de la biblioteca.'
            : 'Modificá emoji, título o quién puede agregar contenido.'}
        </DialogDescription>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
          <div className="flex gap-3">
            <label className="block w-24">
              <span className="mb-1 block text-sm text-muted">Emoji</span>
              <input
                type="text"
                maxLength={CATEGORY_EMOJI_MAX_LENGTH}
                placeholder="📚"
                aria-invalid={formState.errors.emoji ? true : undefined}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-center text-2xl text-text focus:border-text focus:outline-none"
                {...register('emoji', { required: true })}
              />
            </label>

            <label className="block flex-1">
              <span className="mb-1 block text-sm text-muted">Título</span>
              <input
                type="text"
                maxLength={CATEGORY_TITLE_MAX_LENGTH}
                placeholder="Recetas, Tutoriales, Recursos…"
                aria-invalid={formState.errors.title ? true : undefined}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-text focus:outline-none"
                {...register('title', { required: true })}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-muted">Quién puede agregar contenido</span>
            <select
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text focus:border-text focus:outline-none"
              {...register('contributionPolicy', { required: true })}
            >
              {CONTRIBUTION_POLICY_VALUES.map((p) => (
                <option key={p} value={p}>
                  {contributionPolicyLabel(p)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">
              {contributionPolicyDescription(policy)}
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <DialogClose asChild>
              <button
                type="button"
                disabled={pending}
                className="rounded-md px-3 py-2 text-sm text-muted hover:text-text"
              >
                Cancelar
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-4 py-2 text-sm text-bg disabled:opacity-60"
            >
              {submitText}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
