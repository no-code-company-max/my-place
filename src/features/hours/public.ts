/**
 * API pública client-safe del slice `hours`. Tipos puros, helpers de
 * dominio (sin I/O), schemas Zod, server actions (callables desde Client
 * Components) y componentes UI.
 *
 * **No** incluye queries server-only ni helpers que toquen Prisma — viven
 * en `public.server.ts`. Mezclar `import 'server-only'` acá rompería el
 * build cuando un Client Component que viaja al bundle importa de este
 * archivo (ej: `events/ui/event-form.tsx` necesita `ALLOWED_TIMEZONES`).
 *
 * Ver `docs/decisions/2026-04-21-flags-subslice-split.md` § "Boundary
 * client vs server" — mismo patrón.
 */

export type {
  DateException,
  DayOfWeek,
  OpeningHours,
  OpenStatus,
  RecurringWindow,
  TimeOfDay,
} from './domain/types'

export { currentOpeningWindow, isPlaceOpen, nextOpeningWindow } from './domain/invariants'
export { ALLOWED_TIMEZONES, isAllowedTimezone } from './domain/timezones'
export type { AllowedTimezone } from './domain/timezones'
export {
  openingHoursSchema,
  parseOpeningHours,
  updateHoursInputSchema,
  type UpdateHoursInput,
} from './schemas'

export { updatePlaceHoursAction } from './server/actions'

export { HoursForm, type HoursFormDefaults } from './ui/hours-form'
export { HoursPreview } from './ui/hours-preview'
export { PlaceClosedView } from './ui/place-closed-view'
