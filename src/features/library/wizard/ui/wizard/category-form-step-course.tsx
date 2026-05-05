'use client'

import { useEffect } from 'react'
import type { LibraryCategoryKind } from '@/features/library/public'
import type { WizardStepProps } from '@/shared/ui/wizard'
import type { CategoryFormValue } from './category-form-types'

/**
 * Step 4: tipo de categoría.
 *
 * Toggle binario GENERAL ↔ COURSE. Sólo flag — la asignación de prereqs
 * a items se hace al crear/editar cada item, no en este wizard (decisión
 * #C4 sesión 2026-05-04).
 *
 * Validación: siempre válido (un radio siempre tiene valor).
 */
export function CategoryFormStepCourse({
  value,
  onChange,
  onValid,
}: WizardStepProps<CategoryFormValue>): React.ReactNode {
  useEffect(() => {
    onValid(true)
  }, [onValid])

  function setKind(next: LibraryCategoryKind): void {
    onChange({ ...value, kind: next })
  }

  return (
    <div className="space-y-4 py-2">
      <fieldset className="space-y-2">
        <legend className="mb-1 block text-sm text-neutral-600">Tipo de categoría</legend>
        <RadioOption
          checked={value.kind === 'GENERAL'}
          onChange={() => setKind('GENERAL')}
          title="General"
          description="Cualquier recurso. Sin prereqs ni tracking de completion."
        />
        <RadioOption
          checked={value.kind === 'COURSE'}
          onChange={() => setKind('COURSE')}
          title="Curso"
          description="Los items pueden requerir completar otro item antes. Cada miembro ve su propio progreso."
        />
      </fieldset>
    </div>
  )
}

function RadioOption({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean
  onChange: () => void
  title: string
  description: string
}): React.ReactNode {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 ${
        checked ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-300'
      }`}
    >
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 h-4 w-4" />
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-neutral-600">{description}</span>
      </span>
    </label>
  )
}
