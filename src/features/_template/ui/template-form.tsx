'use client'

import { useForm } from 'react-hook-form'
import { templateCreateSchema, type TemplateCreateInput } from '../schemas'

/**
 * Client Component de ejemplo — form tipado con react-hook-form + Zod.
 * La action se pasa por prop para mantener el componente agnóstico del server runtime.
 */
export function TemplateForm({
  onSubmit,
}: {
  onSubmit: (input: TemplateCreateInput) => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TemplateCreateInput>()

  return (
    <form
      onSubmit={handleSubmit(async (raw) => {
        const parsed = templateCreateSchema.parse(raw)
        await onSubmit(parsed)
      })}
      className="flex flex-col gap-2"
    >
      <input
        {...register('name')}
        className="rounded-md border border-place-divider px-3 py-2"
        placeholder="Nombre"
      />
      {errors.name && <span className="text-sm text-place-text-soft">{errors.name.message}</span>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-place-mark-bg px-4 py-2 text-place-mark-fg"
      >
        {isSubmitting ? 'Enviando…' : 'Guardar'}
      </button>
    </form>
  )
}
