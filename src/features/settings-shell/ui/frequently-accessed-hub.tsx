'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { SidebarSections } from '@/shared/ui/sidebar/sidebar.types'
import { getTopUsage, type UsageEntry } from '../lib/track-settings-usage'

/**
 * Atajo mobile a las settings más usadas. Lee `localStorage` (vía
 * `getTopUsage`) y renderea hasta `topN` cards lineadas a las sub-pages
 * correspondientes.
 *
 * - Solo se muestra en `/settings` raíz mobile (renderizado dentro del
 *   `<SettingsMobileHub>`).
 * - Si no hay tracking previo (user nuevo), retorna `null` — no mostramos
 *   un placeholder vacío "Aún no usaste nada", dejaríamos al user con un
 *   bloque visual sin valor.
 * - El initial render server-side es `null` (localStorage es client-only);
 *   useEffect post-mount hidrata con los counts reales.
 *
 * Para resolver labels + iconos por slug, recibe `sections` del feature
 * (mismo data que el Sidebar). Si un tracked slug no matchéa ningún item
 * de las sections (slug deprecated), se filtra silenciosamente.
 */
type Props = {
  sections: SidebarSections
  topN?: number
}

export function FrequentlyAccessedHub({ sections, topN = 3 }: Props): React.ReactNode {
  const [top, setTop] = useState<UsageEntry[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setTop(getTopUsage(topN))
    setHydrated(true)
  }, [topN])

  // Pre-hydration: render null para evitar mismatch SSR (server no tiene
  // localStorage; client lo lee post-mount).
  if (!hydrated) return null
  if (top.length === 0) return null

  // Resolve slug → item desde la data de sections (incluye href + label + icon).
  const itemsBySlug = new Map<string, SidebarSections[number]['items'][number]>()
  for (const group of sections) {
    for (const item of group.items) {
      const slug = item.href.match(/\/settings\/([a-z][a-z0-9-]*)/)?.[1]
      if (slug) itemsBySlug.set(slug, item)
    }
  }

  const visibleEntries = top
    .map((entry) => ({ entry, item: itemsBySlug.get(entry.slug) }))
    .filter((x): x is { entry: UsageEntry; item: NonNullable<typeof x.item> } => Boolean(x.item))

  if (visibleEntries.length === 0) return null

  return (
    <section aria-labelledby="frequently-accessed-heading" className="space-y-2">
      <h2
        id="frequently-accessed-heading"
        className="px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500"
      >
        Frecuentes
      </h2>
      <ul className="grid grid-cols-1 gap-2">
        {visibleEntries.map(({ entry, item }) => (
          <li key={entry.slug}>
            <Link
              href={item.href}
              className="flex min-h-[56px] items-center gap-3 rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
            >
              {item.icon ? (
                <span className="shrink-0 text-neutral-500" aria-hidden>
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
