'use client'

import { useState, useTransition } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { toast } from '@/shared/ui/toaster'
import { formatPrice } from '@/shared/lib/format-price'
import { setTierVisibilityAction, tierDurationLabel } from '@/features/tiers/public'
import type { Tier, TierCurrency, TierDuration, TierVisibility } from '@/features/tiers/public'
import { friendlyTierErrorMessage } from './errors'
import { TierFormSheet } from './tier-form-sheet'

type Props = {
  placeSlug: string
  tiers: ReadonlyArray<Tier>
}

/** SheetState pattern como `<CategoryListAdmin>`. v1 no borra tiers
 *  (decisión #3 ADR — sin archivedAt). HIDDEN inline sin confirm modal. */
type SheetState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | {
      kind: 'edit'
      tierId: string
      initialName: string
      initialDescription: string | null
      initialPriceCents: number
      initialCurrency: TierCurrency
      initialDuration: TierDuration
    }

/** Listado + orquestador de overlays para `/settings/tiers`. PUBLISHED chip
 *  neutral, HIDDEN chip amber (recoverable → amber, no rojo). */
export function TiersListAdmin({ placeSlug, tiers }: Props): React.ReactNode {
  const [sheet, setSheet] = useState<SheetState>({ kind: 'closed' })

  function close(): void {
    setSheet({ kind: 'closed' })
  }

  // Mode estable para `<TierFormSheet>` — cuando el sheet no está abierto en
  // create/edit, igual hay que pasarle un `mode` válido (la prop es required).
  // Bake un valor sensible: `placeSlug` para create, o el payload de edit si
  // está activo. Como `open=false` en esos casos, el contenido del form no se
  // renderiza (Radix Dialog no monta el portal).
  const formSheetOpen = sheet.kind === 'create' || sheet.kind === 'edit'
  const formSheetMode =
    sheet.kind === 'edit'
      ? {
          kind: 'edit' as const,
          tierId: sheet.tierId,
          initialName: sheet.initialName,
          initialDescription: sheet.initialDescription,
          initialPriceCents: sheet.initialPriceCents,
          initialCurrency: sheet.initialCurrency,
          initialDuration: sheet.initialDuration,
        }
      : { kind: 'create' as const, placeSlug }

  return (
    <section aria-labelledby="tiers-list-heading" className="space-y-3">
      <div>
        <h2
          id="tiers-list-heading"
          className="border-b pb-2 font-serif text-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          Tiers
        </h2>
        <p className="mt-1 text-xs text-neutral-600">
          {tiers.length} {tiers.length === 1 ? 'tier' : 'tiers'} · los nuevos arrancan ocultos.
        </p>
      </div>

      {tiers.length === 0 ? (
        <p className="text-sm italic text-neutral-500">
          Todavía no hay tiers. Definí el primero para empezar a estructurar la membresía del place.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {tiers.map((tier) => (
            <TierRow
              key={tier.id}
              tier={tier}
              onEdit={() =>
                setSheet({
                  kind: 'edit',
                  tierId: tier.id,
                  initialName: tier.name,
                  initialDescription: tier.description,
                  initialPriceCents: tier.priceCents,
                  initialCurrency: tier.currency,
                  initialDuration: tier.duration,
                })
              }
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setSheet({ kind: 'create' })}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 hover:border-neutral-500"
      >
        <span aria-hidden="true">+</span> Nuevo tier
      </button>

      <TierFormSheet
        open={formSheetOpen}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        mode={formSheetMode}
      />
    </section>
  )
}

// ---------------------------------------------------------------
// Row component (internal). Vive en el mismo archivo para mantener
// el orquestador autocontenido y evitar prop drilling para el
// dispatch de visibility.
// ---------------------------------------------------------------

type TierRowProps = {
  tier: Tier
  onEdit: () => void
}

function TierRow({ tier, onEdit }: TierRowProps): React.ReactNode {
  const [pending, startTransition] = useTransition()
  const isPublished = tier.visibility === 'PUBLISHED'
  const targetVisibility: TierVisibility = isPublished ? 'HIDDEN' : 'PUBLISHED'

  function handleVisibilityToggle(): void {
    startTransition(async () => {
      try {
        const result = await setTierVisibilityAction({
          tierId: tier.id,
          visibility: targetVisibility,
        })
        if (!result.ok) {
          // Intento de publicar mientras otro tier PUBLISHED tiene el mismo
          // nombre case-insensitive (decisión #11 ADR + partial unique).
          if (result.error === 'name_already_published') {
            toast.error(
              'Ya hay otro tier publicado con ese nombre. Ocultalo antes de publicar este.',
            )
          }
          return
        }
        toast.success(targetVisibility === 'PUBLISHED' ? 'Tier publicado.' : 'Tier oculto.')
      } catch (err) {
        toast.error(friendlyTierErrorMessage(err))
      }
    })
  }

  // Chip canónico: neutral si publicado (estado "normal"), amber si oculto
  // (estado "retirado, requiere acción del owner para volverse visible").
  const chipClass = isPublished
    ? 'rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] text-neutral-600'
    : 'rounded-full border border-amber-300 px-2 py-0.5 text-[11px] text-amber-700'
  const chipLabel = isPublished ? 'Publicado' : 'Oculto'

  // Accessible names para el dropdown menuitem de toggle. Los E2E asertan
  // estos nombres exactos (`Publicar tier` / `Ocultar tier`).
  const toggleLabel = isPublished ? 'Ocultar tier' : 'Publicar tier'

  return (
    <li className="flex min-h-[56px] items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-serif text-base">{tier.name}</h3>
          <span className={chipClass}>{chipLabel}</span>
        </div>
        <p className="mt-0.5 text-xs text-neutral-600">
          <span>{formatPrice(tier.priceCents, tier.currency)}</span>
          <span className="mx-1.5">·</span>
          <span>{tierDurationLabel(tier.duration)}</span>
        </p>
        {tier.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{tier.description}</p>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100"
            aria-label={`Opciones para ${tier.name}`}
            disabled={pending}
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
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              // Radix cierra el menu automáticamente tras onSelect — no
              // bloqueamos el cierre. El `startTransition` corre en background;
              // el toast + revalidate dan feedback del resultado.
              handleVisibilityToggle()
            }}
            aria-label={toggleLabel}
          >
            {toggleLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
