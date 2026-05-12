'use client'

import { useEffect, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import {
  EditPanel,
  EditPanelBody,
  EditPanelClose,
  EditPanelContent,
  EditPanelDescription,
  EditPanelFooter,
  EditPanelHeader,
  EditPanelTitle,
} from '@/shared/ui/edit-panel'
import { toast } from '@/shared/ui/toaster'
import {
  TIER_DESCRIPTION_MAX_LENGTH,
  TIER_DURATION_VALUES,
  TIER_NAME_MAX_LENGTH,
  TIER_PRICE_CENTS_MAX,
  createTierAction,
  tierDurationLabel,
  updateTierAction,
} from '@/features/tiers/public'
import type { TierCurrency, TierDuration } from '@/features/tiers/public'
import { friendlyTierErrorMessage } from './errors'

type CreateMode = {
  kind: 'create'
  placeSlug: string
}

type EditMode = {
  kind: 'edit'
  tierId: string
  initialName: string
  initialDescription: string | null
  initialPriceCents: number
  initialCurrency: TierCurrency
  initialDuration: TierDuration
}

type Props = {
  open: boolean
  onOpenChange: (next: boolean) => void
  mode: CreateMode | EditMode
}

type FormValues = {
  name: string
  description: string
  /** Precio expresado como string en USD (ej "1.99"). Se convierte a
   *  centavos al submit. Mantenemos string en el form porque es lo
   *  natural en un input numérico — el cast happens explícito. */
  priceUsd: string
  duration: TierDuration
}

const DEFAULT_DURATION: TierDuration = 'ONE_MONTH'

/**
 * Convierte un string user-typed (`"1,99"` o `"1.99"`) a centavos enteros.
 * Acepta coma o punto como separador decimal — UI argentina usa coma.
 * Throw si el string no es un número válido.
 */
function priceUsdToCents(input: string): number {
  const normalized = input.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Precio inválido')
  }
  const cents = Math.round(parseFloat(normalized) * 100)
  if (!Number.isFinite(cents)) {
    throw new Error('Precio inválido')
  }
  return cents
}

function priceCentsToUsd(cents: number): string {
  return (cents / 100).toFixed(2)
}

function initialValuesFor(mode: CreateMode | EditMode): FormValues {
  if (mode.kind === 'create') {
    return { name: '', description: '', priceUsd: '0.00', duration: DEFAULT_DURATION }
  }
  return {
    name: mode.initialName,
    description: mode.initialDescription ?? '',
    priceUsd: priceCentsToUsd(mode.initialPriceCents),
    duration: mode.initialDuration,
  }
}

/**
 * EditPanel con form para crear o editar un tier. Owner-only — el page
 * padre gateó con `if (!perms.isOwner) notFound()`, así que el sheet no
 * necesita gate adicional.
 *
 * API totalmente controlada: el padre (`<TiersListAdmin>`) maneja `open` +
 * `onOpenChange` + `mode` vía un discriminated union de estado (`SheetState`).
 * El sheet no monta su propio trigger.
 *
 * Submit dispara `createTierAction` o `updateTierAction` según el modo.
 * Pending state via `useTransition` (label dinámico "Creando…" / "Guardando…").
 * Toast de éxito/error vía Sonner. La action revalida `/settings/tiers`,
 * así que el listado padre se actualiza solo.
 *
 * Los nuevos arrancan HIDDEN (default del schema) — el form NO incluye
 * campo de visibility. Cambiar visibility se hace con el item dedicado del
 * dropdown.
 *
 * Touch targets: inputs `min-h-[44px] text-base` (16px → evita iOS auto-zoom
 * al focusar). Submit `min-h-12`, cancel `min-h-11`. Mismo patrón que
 * `category-form-sheet.tsx` (canónico de UX patterns).
 */
export function TierFormSheet({ open, onOpenChange, mode }: Props): React.ReactNode {
  const [pending, startTransition] = useTransition()

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: initialValuesFor(mode),
  })

  // Reset al abrir para que el form refleje los valores iniciales del modo
  // activo. Sin esto, abrir el sheet en `edit` después de un `create` (o
  // viceversa) muestra los valores del modo previo.
  useEffect(() => {
    if (open) {
      reset(initialValuesFor(mode))
    }
    // `mode` es estable durante una apertura — el padre solo lo cambia
    // mientras `open=false`. Listamos `open` como dep principal; cuando
    // cambia a true, leemos el `mode` actual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function onSubmit(values: FormValues): void {
    let priceCents: number
    try {
      priceCents = priceUsdToCents(values.priceUsd)
    } catch {
      toast.error('El precio debe ser un número como 0, 1.99 o 9999.99.')
      return
    }
    if (priceCents < 0 || priceCents > TIER_PRICE_CENTS_MAX) {
      toast.error(`El precio debe estar entre 0 y ${(TIER_PRICE_CENTS_MAX / 100).toFixed(2)}.`)
      return
    }

    startTransition(async () => {
      try {
        if (mode.kind === 'create') {
          // createTier nunca retorna ok=false (los nuevos arrancan HIDDEN —
          // no pueden violar el partial unique sobre PUBLISHED).
          await createTierAction({
            placeSlug: mode.placeSlug,
            name: values.name,
            description: values.description.trim().length > 0 ? values.description : null,
            priceCents,
            currency: 'USD',
            duration: values.duration,
          })
          toast.success('Tier creado (oculto). Publicalo cuando esté listo.')
        } else {
          const result = await updateTierAction({
            tierId: mode.tierId,
            name: values.name,
            description: values.description.trim().length > 0 ? values.description : null,
            priceCents,
            currency: 'USD',
            duration: values.duration,
          })
          if (!result.ok) {
            // El tier que se edita está PUBLISHED y el nuevo name colisiona
            // con otro PUBLISHED — owner debe ocultar el otro primero.
            if (result.error === 'name_already_published') {
              toast.error(
                'Ya hay otro tier publicado con ese nombre. Ocultalo antes de cambiar este.',
              )
            }
            return
          }
          toast.success('Tier actualizado.')
        }
        onOpenChange(false)
      } catch (err) {
        // Errores no esperados (auth, notfound, validación). Caen al
        // mapper genérico — el cliente ve un copy de fallback.
        toast.error(friendlyTierErrorMessage(err))
      }
    })
  }

  const titleText = mode.kind === 'create' ? 'Nuevo tier' : 'Editar tier'
  const descriptionText =
    mode.kind === 'create'
      ? 'Definí un segmento de membresía. Los tiers nuevos arrancan ocultos.'
      : 'Modificá nombre, precio o duración del tier.'
  // Sub-form pattern canon (ux-patterns § Color palette): el sheet usa
  // "Listo" — el commit explícito atómico de esta acción se hace en el
  // server action invocado al submit, NO en un "Guardar cambios" page-level
  // (tiers no tiene form page-level, cada CRUD es discreto).
  const submitText = pending ? (mode.kind === 'create' ? 'Creando…' : 'Guardando…') : 'Listo'

  return (
    <EditPanel open={open} onOpenChange={onOpenChange}>
      <EditPanelContent aria-describedby={undefined}>
        <EditPanelHeader>
          <EditPanelTitle>{titleText}</EditPanelTitle>
          <EditPanelDescription>{descriptionText}</EditPanelDescription>
        </EditPanelHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <EditPanelBody>
            <div className="space-y-4 py-2">
              <label className="block">
                <span className="mb-1 block text-sm text-neutral-600">Nombre</span>
                <input
                  type="text"
                  maxLength={TIER_NAME_MAX_LENGTH}
                  placeholder="Básico, Premium, Colaboradores…"
                  aria-invalid={formState.errors.name ? true : undefined}
                  className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                  {...register('name', { required: true })}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-neutral-600">Descripción (opcional)</span>
                <textarea
                  maxLength={TIER_DESCRIPTION_MAX_LENGTH}
                  rows={3}
                  placeholder="Qué incluye este tier."
                  className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                  {...register('description')}
                />
              </label>

              <div className="flex gap-3">
                <label className="block flex-1">
                  <span className="mb-1 block text-sm text-neutral-600">Precio (USD)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00 o 1.99"
                    aria-invalid={formState.errors.priceUsd ? true : undefined}
                    className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                    {...register('priceUsd', { required: true })}
                  />
                  <span className="mt-1 block text-xs text-neutral-600">0 = gratis</span>
                </label>

                <label className="block flex-1">
                  <span className="mb-1 block text-sm text-neutral-600">Duración</span>
                  <select
                    className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base focus:border-neutral-500 focus:outline-none"
                    {...register('duration', { required: true })}
                  >
                    {TIER_DURATION_VALUES.map((d) => (
                      <option key={d} value={d}>
                        {tierDurationLabel(d)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </EditPanelBody>

          <EditPanelFooter>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitText}
            </button>
            <EditPanelClose asChild>
              <button
                type="button"
                disabled={pending}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-neutral-300 px-4 text-sm disabled:opacity-60"
              >
                Cancelar
              </button>
            </EditPanelClose>
          </EditPanelFooter>
        </form>
      </EditPanelContent>
    </EditPanel>
  )
}
