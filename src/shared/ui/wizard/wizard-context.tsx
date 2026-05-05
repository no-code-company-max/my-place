'use client'

import { createContext, useContext, type ComponentType } from 'react'

/**
 * Tipos públicos + Context interno del wizard primitive.
 *
 * Vive aparte de `wizard.tsx` para mantener el archivo principal bajo
 * el cap de 300 LOC del proyecto y para que los sub-componentes
 * (`wizard-header.tsx`, `wizard-body.tsx`, `wizard-footer.tsx`)
 * importen el hook + tipos sin importar la implementación del
 * orquestador.
 *
 * Ver `wizard.tsx` para el contrato completo y las decisiones de
 * comportamiento (D8 + D12 del ADR
 * `docs/decisions/2026-05-04-library-courses-and-read-access.md`).
 */

export type WizardStepProps<T> = {
  value: T
  onChange: (next: T) => void
  onValid: (isValid: boolean) => void
}

export type WizardStep<T> = {
  id: string
  label: string
  Component: ComponentType<WizardStepProps<T>>
}

export type WizardContextValue<T> = {
  steps: ReadonlyArray<WizardStep<T>>
  currentIndex: number
  value: T
  isCurrentValid: boolean
  isLast: boolean
  isFirst: boolean
  isSubmitting: boolean
  closeLabel: string
  next: () => void
  back: () => void
  submit: () => void | Promise<void>
  close: () => void
  setValue: (next: T) => void
  setStepValid: (stepId: string, isValid: boolean) => void
}

// `unknown` en el genérico es seguro porque todos los consumers
// acceden vía `useWizardContext<T>()` que castea al T del consumer.
// El context value siempre lo creó un `<Wizard<T>>` con su propio T —
// la coherencia se mantiene a nivel del árbol React.
export const WizardContext = createContext<WizardContextValue<unknown> | null>(null)

export function useWizardContext<T>(): WizardContextValue<T> {
  const ctx = useContext(WizardContext)
  if (ctx === null) {
    throw new Error('Wizard sub-componentes deben usarse dentro de <Wizard>.')
  }
  return ctx as WizardContextValue<T>
}
