'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { WizardContext, type WizardContextValue, type WizardStep } from './wizard-context'
import { WizardHeader } from './wizard-header'
import { WizardBody } from './wizard-body'
import { WizardFooter } from './wizard-footer'

/**
 * Wizard primitive genérico y reusable.
 *
 * Sirve para componer flujos multi-step lineales (ej: form de creación
 * de categoría library con 4 pasos, onboarding, configuración de tier,
 * etc.). NO sabe nada de un dominio concreto: el consumer decide la
 * shape de `value: T`, los Componentes de cada step y dónde montarlo
 * (BottomSheet, Dialog, página dedicada, etc.).
 *
 * Comportamiento canónico (decisión D8 + D12 del ADR
 * `docs/decisions/2026-05-04-library-courses-and-read-access.md`):
 *
 *  - **Lineal forzado**: navegación únicamente Atrás / Siguiente. Sin
 *    saltos arbitrarios entre steps.
 *  - **Validación por step**: cada step llama `onValid(boolean)` en su
 *    componente. El botón Siguiente queda disabled hasta que el step
 *    actual reporta `true`.
 *  - **Sin draft persistence**: state vive sólo en memoria. Cierre =
 *    progreso perdido. NO persistimos a server entre steps.
 *  - **X cierra**: header expone botón X que invoca `onClose`. No hay
 *    botón "Cancelar" separado — la X es el único cancel.
 *  - **Atrás preserva state**: el `value` acumulado no se pierde al
 *    retroceder; los steps anteriores muestran lo que el usuario tipeó.
 *  - **Submit asincrónico**: si `onComplete` retorna Promise, el botón
 *    Guardar muestra estado pending y se deshabilita junto con Atrás
 *    hasta resolver. Mensajes de éxito/error son responsabilidad del
 *    consumer (típicamente `toast.*`).
 *
 * API target:
 *
 * ```tsx
 * <Wizard
 *   steps={[
 *     { id: 'identity', label: 'Identidad', Component: IdentityStep },
 *     { id: 'access', label: 'Aporte', Component: AccessStep },
 *   ]}
 *   initialValue={{ ... }}
 *   onComplete={(value) => ...}
 *   onClose={() => ...}
 * >
 *   <Wizard.Header />
 *   <Wizard.Body />
 *   <Wizard.Footer />
 * </Wizard>
 * ```
 *
 * Cada step recibe `value: T`, `onChange: (next: T) => void`, y
 * `onValid: (isValid: boolean) => void`. La discriminación de shape
 * por step (qué slice de `T` cada step lee/escribe) es
 * responsabilidad del Componente del step — el wizard sólo orquesta.
 *
 * El primitive no monta container — `<Wizard.Header>` / `<Wizard.Body>`
 * / `<Wizard.Footer>` son children compositivos que el consumer pone
 * dentro de su contenedor preferido (sheet, dialog, page).
 *
 * Estilos: paleta neutral cruda (alineado con `docs/ux-patterns.md` §
 * "Color palette & button styles") — settings chrome, no brand. Sin
 * animaciones agresivas (alineado con CLAUDE.md "nada parpadea").
 */

type WizardProps<T> = {
  steps: ReadonlyArray<WizardStep<T>>
  initialValue: T
  onComplete: (value: T) => void | Promise<void>
  onClose: () => void
  /** Texto del botón X (default "Cerrar"). */
  closeLabel?: string
  children: ReactNode
}

export function Wizard<T>({
  steps,
  initialValue,
  onComplete,
  onClose,
  closeLabel = 'Cerrar',
  children,
}: WizardProps<T>): React.ReactNode {
  if (steps.length === 0) {
    throw new Error('<Wizard> requiere al menos 1 step.')
  }

  const [currentIndex, setCurrentIndex] = useState(0)
  const [value, setValueState] = useState<T>(initialValue)
  const [validityByStep, setValidityByStep] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setValue = useCallback((next: T) => {
    setValueState(next)
  }, [])

  const setStepValid = useCallback((stepId: string, isValid: boolean) => {
    setValidityByStep((prev) => {
      if (prev[stepId] === isValid) return prev
      return { ...prev, [stepId]: isValid }
    })
  }, [])

  const currentStep = steps[currentIndex]
  if (currentStep === undefined) {
    // Defensive — currentIndex se mantiene en rango por next/back.
    throw new Error('<Wizard> currentIndex fuera de rango.')
  }
  const isCurrentValid = validityByStep[currentStep.id] === true
  const isLast = currentIndex === steps.length - 1
  const isFirst = currentIndex === 0

  const next = useCallback(() => {
    if (!isCurrentValid || isLast || isSubmitting) return
    setCurrentIndex((idx) => idx + 1)
  }, [isCurrentValid, isLast, isSubmitting])

  const back = useCallback(() => {
    if (isFirst || isSubmitting) return
    setCurrentIndex((idx) => idx - 1)
  }, [isFirst, isSubmitting])

  const submit = useCallback(async () => {
    if (!isCurrentValid || !isLast || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onComplete(value)
    } finally {
      setIsSubmitting(false)
    }
  }, [isCurrentValid, isLast, isSubmitting, onComplete, value])

  const close = useCallback(() => {
    onClose()
  }, [onClose])

  const ctx = useMemo<WizardContextValue<T>>(
    () => ({
      steps,
      currentIndex,
      value,
      isCurrentValid,
      isLast,
      isFirst,
      isSubmitting,
      closeLabel,
      next,
      back,
      submit,
      close,
      setValue,
      setStepValid,
    }),
    [
      steps,
      currentIndex,
      value,
      isCurrentValid,
      isLast,
      isFirst,
      isSubmitting,
      closeLabel,
      next,
      back,
      submit,
      close,
      setValue,
      setStepValid,
    ],
  )

  return (
    <WizardContext.Provider value={ctx as WizardContextValue<unknown>}>
      {children}
    </WizardContext.Provider>
  )
}

// Exportamos como propiedades estáticas para soportar la API
// `<Wizard.Header />`, `<Wizard.Body />`, `<Wizard.Footer />`.
Wizard.Header = WizardHeader
Wizard.Body = WizardBody
Wizard.Footer = WizardFooter
