'use client'

import { useWizardContext } from './wizard-context'

/**
 * Footer del wizard primitive.
 *
 * Stack vertical mobile-first con dos botones:
 *  - Primary: "Siguiente" en steps intermedios, "Guardar" en último
 *    step. Disabled si el step actual no es válido o hay submit en
 *    curso. Estilo `bg-neutral-900 text-white min-h-12` (canónico de
 *    `docs/ux-patterns.md` § "Color palette").
 *  - Secundario "Atrás": disabled en primer step y durante submit.
 *    Estilo outline `border-neutral-300 min-h-11`.
 *
 * Sin botón "Cancelar" — la X del header cumple esa función (D8/C5
 * ADR `docs/decisions/2026-05-04-library-courses-and-read-access.md`).
 *
 * Orden visual (primary arriba, atrás abajo): mantiene el CTA primary
 * en thumb-zone bajo en mobile cuando el footer es sticky en un
 * BottomSheet — alineado con el patrón de `BottomSheetFooter`.
 */
export function WizardFooter(): React.ReactNode {
  const { isFirst, isLast, isCurrentValid, isSubmitting, next, back, submit } =
    useWizardContext<unknown>()

  function handlePrimary(): void {
    if (isLast) {
      void submit()
    } else {
      next()
    }
  }

  const primaryLabel = isLast ? 'Guardar' : 'Siguiente'
  const primaryDisabled = !isCurrentValid || isSubmitting

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3">
      <button
        type="button"
        onClick={handlePrimary}
        disabled={primaryDisabled}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {primaryLabel}
      </button>
      <button
        type="button"
        onClick={back}
        disabled={isFirst || isSubmitting}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm text-neutral-900 disabled:opacity-50"
      >
        Atrás
      </button>
    </div>
  )
}
