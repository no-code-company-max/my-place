'use client'

import { useWizardContext } from './wizard-context'

/**
 * Header del wizard primitive.
 *
 * Muestra el indicador "Paso X de N", el label del step actual y un
 * botón X que dispara `onClose` (D8 del ADR — sin botón Cancelar
 * separado, la X es el único cancel).
 *
 * Indicador de progreso: lista de barritas finas con estado activo /
 * pasado / futuro. Sin animación pulsante, sin bounce, sin progress
 * bar animado — alineado con CLAUDE.md "nada parpadea, nada grita".
 *
 * `aria-current="step"` en el item del step activo + `aria-label`
 * descriptivo en cada barra para lectores de pantalla.
 */
export function WizardHeader(): React.ReactNode {
  const { steps, currentIndex, close, closeLabel } = useWizardContext<unknown>()
  const current = steps[currentIndex]
  if (current === undefined) return null

  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-600">
          Paso {currentIndex + 1} de {steps.length}
        </p>
        <h2 className="font-serif text-xl text-neutral-900">{current.label}</h2>
        <ol aria-label="Progreso del wizard" className="mt-2 flex items-center gap-1.5">
          {steps.map((step, idx) => {
            const isActive = idx === currentIndex
            const isPast = idx < currentIndex
            return (
              <li
                key={step.id}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Paso ${idx + 1}: ${step.label}`}
                className={[
                  'h-1 flex-1 rounded-full',
                  isActive ? 'bg-neutral-900' : isPast ? 'bg-neutral-700' : 'bg-neutral-200',
                ].join(' ')}
              />
            )
          })}
        </ol>
      </div>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={close}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
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
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}
