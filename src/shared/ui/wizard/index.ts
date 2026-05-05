/**
 * Surface pública del wizard primitive.
 *
 * Consumers importan via `@/shared/ui/wizard`:
 *
 * ```tsx
 * import { Wizard, type WizardStep, type WizardStepProps } from '@/shared/ui/wizard'
 * ```
 *
 * Sub-componentes (`Wizard.Header`, `Wizard.Body`, `Wizard.Footer`) se
 * accesan como propiedades estáticas del orquestador, no como exports
 * separados — refleja la API compositiva canónica.
 */

export { Wizard } from './wizard'
export type { WizardStep, WizardStepProps } from './wizard-context'
