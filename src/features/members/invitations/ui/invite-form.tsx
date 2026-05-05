'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '@/shared/ui/toaster'
import { inviteMemberSchema } from '@/features/members/schemas'
import { inviteMemberAction } from '../server/actions/invite'
import { isDomainError } from '@/shared/errors/domain-error'

/**
 * Form de invitación para settings/access. Espera renderizarse dentro del place
 * (subdomain del tenant) y recibe `placeSlug` del server component padre.
 *
 * Sigue los UX patterns canónicos: inputs `min-h-[44px] text-base`, submit
 * `bg-neutral-900` full-width `min-h-12`, feedback de save vía Sonner toast,
 * inline errors sólo para validación Zod client-side.
 */

type FormValues = { email: string; asAdmin: boolean }

export function InviteMemberForm({ placeSlug }: { placeSlug: string }) {
  const [pending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({})

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { email: '', asAdmin: false },
  })

  function onSubmit(values: FormValues) {
    setFieldErrors({})

    const parsed = inviteMemberSchema.safeParse({
      placeSlug,
      email: values.email,
      asAdmin: values.asAdmin,
    })
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormValues, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues | undefined
        if (key && !errs[key]) errs[key] = issue.message
      }
      setFieldErrors(errs)
      return
    }

    startTransition(async () => {
      try {
        await inviteMemberAction(parsed.data)
        toast.success('Invitación enviada.')
        reset({ email: '', asAdmin: false })
      } catch (err) {
        toast.error(friendlyMessage(err))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <label className="block">
        <span className="mb-1 block text-sm text-neutral-600">Email</span>
        <input
          type="email"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
          aria-invalid={fieldErrors.email ? true : undefined}
          {...register('email', { required: true })}
        />
        {fieldErrors.email ? (
          <span role="alert" className="mt-1 block text-xs text-amber-700">
            {fieldErrors.email}
          </span>
        ) : null}
      </label>

      <label className="flex min-h-11 items-start gap-2 text-sm text-neutral-600">
        <input type="checkbox" className="mt-1.5" {...register('asAdmin')} />
        <span>Invitar como admin (puede invitar a otros, editar config del place).</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Enviando…' : 'Enviar invitación'}
      </button>
    </form>
  )
}

function friendlyMessage(err: unknown): string {
  if (isDomainError(err)) {
    switch (err.code) {
      case 'VALIDATION':
        return err.message || 'Datos inválidos.'
      case 'AUTHORIZATION':
        return 'No tenés permisos para invitar miembros.'
      case 'NOT_FOUND':
        return 'No encontramos este place.'
      case 'INVARIANT_VIOLATION':
        return err.message
      case 'CONFLICT':
        return err.message
      case 'INVITATION_LINK_GENERATION':
        return 'No pudimos generar el link de invitación. La invitación quedó pendiente — podés reintentar desde "Invitaciones pendientes".'
      case 'INVITATION_EMAIL_FAILED':
        return 'No pudimos enviar el email. La invitación quedó guardada — podés reintentar desde "Invitaciones pendientes".'
      default:
        return 'No se pudo enviar la invitación.'
    }
  }
  return 'Error inesperado. Intentá de nuevo.'
}
