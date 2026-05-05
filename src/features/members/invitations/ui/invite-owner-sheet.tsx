'use client'

import { useEffect, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
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
import { isDomainError } from '@/shared/errors/domain-error'
import { inviteMemberSchema } from '@/features/members/schemas'
import { inviteMemberAction } from '../server/actions/invite'

/**
 * BottomSheet para invitar un nuevo owner desde `/settings/access`.
 *
 * El flow `/access` SÓLO invita owners (no members ni admins): el form fuerza
 * `asOwner: true` (no expone checkbox) y la action server-side aplica auth
 * owner-only + persiste el flag. Al aceptar la invitación, el accept tx crea
 * Membership + GroupMembership al preset Administradores + PlaceOwnership.
 *
 * Member/admin invites NO viven acá: futuros flows los expondrán desde
 * `/settings/members` (decisión 2026-05-03 — `/access` es sólo ownership).
 *
 * UX patterns canónicos: input `min-h-[44px] text-base`, submit `bg-neutral-900
 * text-white min-h-12 w-full`, feedback de save vía Sonner toast, inline error
 * sólo para validación Zod client-side.
 */

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  placeSlug: string
}

type FormValues = { email: string }

export function InviteOwnerSheet({ open, onOpenChange, placeSlug }: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const [emailError, setEmailError] = useState<string | null>(null)

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { email: '' },
  })

  // Reset al abrir/cerrar — sin esto el email tipeado en una apertura previa
  // queda fantasma en la siguiente.
  useEffect(() => {
    if (open) {
      reset({ email: '' })
      setEmailError(null)
    }
  }, [open, reset])

  function onSubmit(values: FormValues): void {
    setEmailError(null)

    const parsed = inviteMemberSchema.safeParse({
      placeSlug,
      email: values.email,
      asOwner: true,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path[0] === 'email')
      setEmailError(issue?.message ?? 'Datos inválidos.')
      return
    }

    startTransition(async () => {
      try {
        await inviteMemberAction(parsed.data)
        toast.success('Invitación de owner enviada.')
        onOpenChange(false)
      } catch (err) {
        toast.error(friendlyMessage(err))
      }
    })
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent aria-describedby={undefined}>
        <BottomSheetHeader>
          <BottomSheetTitle>Invitar owner</BottomSheetTitle>
          <BottomSheetDescription>
            La persona invitada recibe un email; al aceptar queda como co-owner del place.
          </BottomSheetDescription>
        </BottomSheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <BottomSheetBody>
            <div className="space-y-4 py-2">
              <label className="block">
                <span className="mb-1 block text-sm text-neutral-600">Email</span>
                <input
                  type="email"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                  aria-invalid={emailError ? true : undefined}
                  {...register('email', { required: true })}
                />
                {emailError ? (
                  <span role="alert" className="mt-1 block text-xs text-amber-700">
                    {emailError}
                  </span>
                ) : null}
              </label>
            </div>
          </BottomSheetBody>

          <BottomSheetFooter>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? 'Enviando…' : 'Enviar invitación'}
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

function friendlyMessage(err: unknown): string {
  if (isDomainError(err)) {
    switch (err.code) {
      case 'VALIDATION':
        return err.message || 'Datos inválidos.'
      case 'AUTHORIZATION':
        return 'Sólo el owner puede invitar otros owners.'
      case 'NOT_FOUND':
        return 'No encontramos este place.'
      case 'INVARIANT_VIOLATION':
        return err.message
      case 'CONFLICT':
        return err.message
      case 'INVITATION_LINK_GENERATION':
        return 'No pudimos generar el link. La invitación quedó pendiente — podés reintentar.'
      case 'INVITATION_EMAIL_FAILED':
        return 'No pudimos enviar el email. La invitación quedó guardada — podés reintentar.'
      default:
        return 'No se pudo enviar la invitación.'
    }
  }
  return 'Error inesperado. Intentá de nuevo.'
}
