'use client'

import { useWizardContext } from './wizard-context'

/**
 * Body del wizard primitive.
 *
 * Renderiza el componente del step actual con las props inyectadas
 * (`value`, `onChange`, `onValid`). El consumer del wizard NO renderiza
 * el step manualmente — el wizard orquesta cuál Component instanciar
 * según `currentIndex`.
 *
 * Layout: padding vertical neutral. No fija altura — el container
 * externo (BottomSheet, Dialog, etc.) decide overflow / scroll.
 */
export function WizardBody(): React.ReactNode {
  const { steps, currentIndex, value, setValue, setStepValid } = useWizardContext<unknown>()
  const current = steps[currentIndex]
  if (current === undefined) return null
  const StepComponent = current.Component

  return (
    <div className="py-4">
      <StepComponent
        value={value}
        onChange={setValue}
        onValid={(isValid) => setStepValid(current.id, isValid)}
      />
    </div>
  )
}
