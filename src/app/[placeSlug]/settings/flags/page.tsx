import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { PageHeader } from '@/shared/ui/page-header'
import { FlagsAdminPanel, type TargetTypeFilterValue } from '@/features/flags/admin/public'
import { mapFlagToView } from '@/features/flags/public'
import type { FlagStatus } from '@/features/flags/public'
import { listFlagTargetSnapshots, listFlagsByPlace } from '@/features/flags/public.server'

export const metadata: Metadata = {
  title: 'Reportes · Settings',
}

type Tab = 'pending' | 'resolved'

type Props = {
  params: Promise<{ placeSlug: string }>
  searchParams: Promise<{ tab?: string; cursor?: string; type?: string }>
}

const PENDING_STATUSES = ['OPEN'] as const satisfies readonly FlagStatus[]
const RESOLVED_STATUSES = [
  'REVIEWED_ACTIONED',
  'REVIEWED_DISMISSED',
] as const satisfies readonly FlagStatus[]

const TARGET_TYPE_VALUES: ReadonlyArray<TargetTypeFilterValue> = ['all', 'POST', 'COMMENT', 'EVENT']

/**
 * `/settings/flags` — patrón canónico detail-from-list (rediseño 2026-05-14).
 *
 * Tabs URL-based (`?tab=pending|resolved`) + filter chips por tipo de
 * contenido (`?type=all|POST|COMMENT|EVENT`) + paginación cursor-based
 * (`?cursor=`). Click en una row abre el detail panel con preview completo
 * + acciones de moderación. Gate admin/owner ya en `settings/layout.tsx`.
 *
 * Drop `<FlagQueueItem>` legacy + `<TabLink>` inline — todo migra al
 * sub-slice `features/flags/admin/`. El page queda como Server Component
 * que parsea searchParams + carga data + delega rendering al orchestrator.
 *
 * Ver `docs/plans/2026-05-14-redesign-settings-flags.md`.
 */
export default async function SettingsFlagsPage({ params, searchParams }: Props) {
  const { placeSlug } = await params
  const search = await searchParams

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  const tab: Tab = search.tab === 'resolved' ? 'resolved' : 'pending'
  const targetType = parseTargetType(search.type)
  const cursor = decodeCursor(search.cursor)
  const status = tab === 'pending' ? PENDING_STATUSES : RESOLVED_STATUSES

  const { items, nextCursor } = await listFlagsByPlace({
    placeId: place.id,
    status,
    ...(targetType === 'all' ? {} : { targetType }),
    cursor,
  })
  const snapshots = await listFlagTargetSnapshots(items)
  const views = items.map((flag) => {
    const key = `${flag.targetType}:${flag.targetId}`
    return mapFlagToView(flag, snapshots.get(key) ?? null)
  })

  // Hrefs precomputados (no funciones cross-boundary Server → Client).
  const hrefs = {
    pendingTab: buildHref({ tab: 'pending', type: targetType }),
    resolvedTab: buildHref({ tab: 'resolved', type: targetType }),
    typeFilters: Object.fromEntries(
      TARGET_TYPE_VALUES.map((value) => [value, buildHref({ tab, type: value })]),
    ) as Record<TargetTypeFilterValue, string>,
    nextPage: nextCursor ? buildHref({ tab, type: targetType, cursor: nextCursor }) : null,
  }

  return (
    <div className="mx-auto max-w-screen-md space-y-6 px-3 py-6 md:px-4 md:py-8">
      <PageHeader
        title="Reportes"
        description="Cola de moderación del place. Pendientes esperan revisión; resueltos quedan como histórico."
      />

      <FlagsAdminPanel
        placeSlug={place.slug}
        tab={tab}
        targetType={targetType}
        views={views}
        hrefs={hrefs}
      />
    </div>
  )
}

function parseTargetType(raw: string | undefined): TargetTypeFilterValue {
  if (raw === 'POST' || raw === 'COMMENT' || raw === 'EVENT') return raw
  return 'all'
}

function buildHref(params: {
  tab: Tab
  type: TargetTypeFilterValue
  cursor?: { createdAt: Date; id: string }
}): string {
  const sp = new URLSearchParams()
  if (params.tab !== 'pending') sp.set('tab', params.tab)
  if (params.type !== 'all') sp.set('type', params.type)
  if (params.cursor) sp.set('cursor', encodeCursor(params.cursor))
  const qs = sp.toString()
  return qs ? `/settings/flags?${qs}` : '/settings/flags'
}

function encodeCursor(cursor: { createdAt: Date; id: string }): string {
  return encodeURIComponent(`${cursor.createdAt.toISOString()}:${cursor.id}`)
}

function decodeCursor(raw: string | undefined): { createdAt: Date; id: string } | null {
  if (!raw) return null
  const decoded = decodeURIComponent(raw)
  const idx = decoded.indexOf(':')
  if (idx === -1) return null
  const iso = decoded.slice(0, idx)
  const id = decoded.slice(idx + 1)
  const createdAt = new Date(iso)
  if (Number.isNaN(createdAt.getTime()) || id.length === 0) return null
  return { createdAt, id }
}
