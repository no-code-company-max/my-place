'use client'

import { useState, useTransition } from 'react'
import { useForm, useFieldArray, useWatch, FormProvider } from 'react-hook-form'
import { toast } from '@/shared/ui/toaster'
import { ALLOWED_TIMEZONES } from '@/features/hours/domain/timezones'
import { updateHoursInputSchema, type UpdateHoursInput } from '@/features/hours/schemas'
import { updatePlaceHoursAction } from '@/features/hours/server/actions'
import { isDomainError } from '@/shared/errors/domain-error'
import type { DateException, RecurringWindow } from '@/features/hours/domain/types'
import { WeekEditor } from './week-editor'
import { ExceptionsEditor } from './exceptions-editor'
import { humanTimezone } from '@/features/hours/member/public'

/**
 * Form de configuración del horario. Se monta en `/settings/hours` con defaults
 * del `OpeningHours` existente.
 *
 * **Modos**:
 *  - `alwaysOpen=true` → `kind: 'always_open'` (24/7). Oculta WeekEditor +
 *    ExceptionsEditor; el server persiste OpeningHours con `recurring` +
 *    `exceptions` "stashed" para que destogglear no destruya el schedule.
 *  - `alwaysOpen=false` → `kind: 'scheduled'` con ventanas + excepciones.
 *
 * **Save model — todo manual (iter 2026-05-11):**
 *
 * Cualquier cambio (agregar/editar/eliminar ventana, agregar/editar/eliminar
 * excepción, toggle día, copyTo, timezone, 24/7) aplica SOLO localmente. El
 * `formState.isDirty` se enciende automáticamente vía RHF.
 *
 * El user confirma todos los cambios juntos con el botón "Guardar cambios"
 * page-level. NO hay autosave de operaciones single-item — eliminado por
 * decisión UX (modelo previo "soft barrier" era confuso: algunos cambios
 * autosaveaban, otros no, según el estado dirty del form).
 *
 * Indicator visual: el botón "Guardar cambios" + label "• Cambios sin
 * guardar" señalan estado dirty. Sin toasts por cada mutation.
 *
 * **Dirty indicator**: `formState.isDirty` es la fuente de verdad — se
 *  enciende ante cualquier divergencia con el baseline. El page Save
 *  button submits todos los cambios juntos y `reset()`-ea el baseline.
 *
 * Validación: se ejecuta con el mismo `updateHoursInputSchema` que el server;
 * el `safeParse` client-side muestra errores inline antes de hacer el round-trip.
 */

export type HoursFormDefaults = {
  timezone: (typeof ALLOWED_TIMEZONES)[number]
  alwaysOpen: boolean
  recurring: UpdateHoursInput['recurring']
  exceptions: UpdateHoursInput['exceptions']
}

type FormValues = {
  timezone: string
  alwaysOpen: boolean
  recurring: UpdateHoursInput['recurring']
  exceptions: UpdateHoursInput['exceptions']
}

export function HoursForm({
  placeSlug,
  defaults,
}: {
  placeSlug: string
  defaults: HoursFormDefaults
}) {
  const [pending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const methods = useForm<FormValues>({
    defaultValues: {
      timezone: defaults.timezone,
      alwaysOpen: defaults.alwaysOpen,
      recurring: defaults.recurring,
      exceptions: defaults.exceptions,
    },
    mode: 'onSubmit',
  })
  const { register, handleSubmit, control, formState } = methods

  const recurring = useFieldArray({ control, name: 'recurring' })
  const exceptions = useFieldArray({ control, name: 'exceptions' })

  // `useWatch` para la toggle: re-renderea cuando cambia y permite ocultar
  // las secciones de ventanas + excepciones de forma reactiva.
  const alwaysOpen = useWatch({ control, name: 'alwaysOpen' })

  /**
   * Submit core: valida + persiste + actualiza baseline. Compartido entre el
   * batch save (botón "Guardar horario") y los autosaves de window/exception ops.
   *
   * `snapshot` es la fuente de verdad del payload — no leemos `methods.getValues()`
   * acá porque las mutations de RHF (`append/update/remove`) son async respecto al
   * próximo render. El caller pasa el snapshot que YA refleja el cambio.
   */
  function persist(snapshot: FormValues, opts: { successMessage: string }) {
    setFormError(null)

    const parsed = updateHoursInputSchema.safeParse({
      placeSlug,
      kind: snapshot.alwaysOpen ? 'always_open' : 'scheduled',
      timezone: snapshot.timezone,
      recurring: snapshot.recurring,
      exceptions: snapshot.exceptions,
    })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      setFormError(first?.message ?? 'Datos inválidos.')
      return
    }

    startTransition(async () => {
      try {
        await updatePlaceHoursAction(parsed.data)
        toast.success(opts.successMessage)
        // Reset al baseline "limpio" con los valores recién guardados —
        // el indicador "Cambios sin guardar" desaparece.
        methods.reset(snapshot)
      } catch (err) {
        toast.error(friendlyMessage(err))
      }
    })
  }

  function onSubmit(values: FormValues) {
    persist(values, { successMessage: 'Cambios guardados.' })
  }

  // ---------------------------------------------------------------
  // Handlers para window/exception ops — TODO MANUAL.
  //
  // Cada handler solo muta local (RHF append/update/remove/replace). RHF
  // marca dirty automáticamente. El user confirma todos los cambios con
  // "Guardar cambios" page-level (onSubmit → persist).
  //
  // No hay toasts por cada mutación — el indicator visual del botón
  // "Guardar cambios" + label "• Cambios sin guardar" son suficientes.
  // Iter previa "soft barrier" eliminada por decisión UX (era confusa:
  // algunos cambios autosaveaban, otros no, según estado dirty).
  // ---------------------------------------------------------------

  function handleAddRecurring(w: RecurringWindow) {
    recurring.append(w)
  }

  function handleUpdateRecurring(idx: number, w: RecurringWindow) {
    recurring.update(idx, w)
  }

  function handleRemoveRecurring(idx: number) {
    recurring.remove(idx)
  }

  /**
   * Reemplaza el array completo de recurring en una sola operación. Lo usa
   * `<WeekEditor>` para "Copiar a todos los días" / weekdays / weekend +
   * para borrar todas las ventanas de un día (switch ON → OFF).
   */
  function handleReplaceRecurring(next: RecurringWindow[]) {
    recurring.replace(next)
  }

  function handleAddException(e: DateException) {
    exceptions.append(e)
  }

  function handleUpdateException(idx: number, e: DateException) {
    exceptions.update(idx, e)
  }

  function handleRemoveException(idx: number) {
    exceptions.remove(idx)
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 md:space-y-10" noValidate>
        {/* `formError` se queda inline (no toast) porque corresponde a errores
            de validación del schema client-side: el usuario necesita verlos
            cerca del campo problemático para corregir, no como notif fugaz.
            Los success/server errors usan toast (Sonner) para que el feedback
            sea visible aunque el usuario haya scrolleado. */}
        {formError ? (
          <div
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {formError}
          </div>
        ) : null}

        <section className="space-y-2" aria-labelledby="hours-timezone-heading">
          <h2
            id="hours-timezone-heading"
            className="border-b pb-2 font-serif text-xl"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Zona horaria
          </h2>
          <label className="block text-sm">
            <span className="sr-only">Timezone del place</span>
            <select
              {...register('timezone')}
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 focus:border-neutral-500 focus:outline-none"
            >
              {ALLOWED_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {humanTimezone(tz)} — {tz}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            El horario se interpreta siempre en la zona del place, no en la del viewer.
          </p>
        </section>

        {/* Sección unificada que controla AMBOS modos: 24/7 o ventanas semanales.
            La toggle "Abierto 24/7" vive acá porque es una decisión sobre el
            mismo concepto (cuándo está abierto el place), y porque al activarla
            el WeekEditor de abajo deja de tener sentido. */}
        <section className="space-y-4" aria-labelledby="hours-opening-heading">
          <h2
            id="hours-opening-heading"
            className="border-b pb-2 font-serif text-xl"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Horario de apertura
          </h2>

          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              {...register('alwaysOpen')}
              className="mt-1 h-5 w-5 cursor-pointer"
            />
            <div className="flex-1">
              <div className="text-base font-medium" style={{ color: 'var(--text)' }}>
                Abierto 24/7
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                El place está siempre abierto. Las ventanas semanales y excepciones no aplican.
              </div>
            </div>
          </label>

          {alwaysOpen ? (
            <p
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
              role="status"
            >
              El place está abierto las 24 horas, todos los días.
            </p>
          ) : (
            <WeekEditor
              fields={recurring.fields}
              onAdd={handleAddRecurring}
              onUpdate={handleUpdateRecurring}
              onRemove={handleRemoveRecurring}
              onReplace={handleReplaceRecurring}
            />
          )}
        </section>

        {/* Excepciones se ocultan en modo 24/7 — no aplican (no hay horario
            sobre el cual hacer override). */}
        {!alwaysOpen ? (
          <ExceptionsEditor
            fields={exceptions.fields}
            onAdd={handleAddException}
            onUpdate={handleUpdateException}
            onRemove={handleRemoveException}
          />
        ) : null}

        {/* Save button — commits TODOS los cambios pending: timezone, toggle
            24/7, copyTo bulk, y las ops single-item que se difirieron por la
            soft barrier (cuando la op se hizo con form ya dirty).

            El botón está disabled cuando no hay cambios para no engañar al
            usuario con un click sin efecto. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={pending || !formState.isDirty}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {formState.isDirty && !pending ? (
            <span className="text-xs" style={{ color: 'var(--muted)' }} aria-live="polite">
              • Cambios sin guardar
            </span>
          ) : null}
        </div>
      </form>
    </FormProvider>
  )
}

function friendlyMessage(err: unknown): string {
  if (isDomainError(err)) {
    switch (err.code) {
      case 'VALIDATION':
        return err.message || 'Horario inválido.'
      case 'AUTHORIZATION':
        return 'No tenés permisos para editar este horario.'
      case 'NOT_FOUND':
        return 'No encontramos este place.'
      default:
        return err.message
    }
  }
  // Server Action stale: pasa cuando el browser tiene el form de un deploy
  // anterior y el ID hasheado del action ya no existe. En dev se dispara
  // tras cada HMR del form; en prod puede pasar si hay un tab abierto durante
  // un deploy. Fix: refrescar la página resincroniza el ID nuevo.
  if (
    err instanceof Error &&
    /Failed to find Server Action|Server Action.*not found/i.test(err.message)
  ) {
    return 'El formulario quedó desactualizado (probablemente porque la app se actualizó). Refrescá la página y volvé a intentar.'
  }
  return 'Error inesperado. Intentá de nuevo.'
}
