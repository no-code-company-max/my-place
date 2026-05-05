'use client'

import { useRouter } from 'next/navigation'
import { TimeAgo } from '@/shared/ui/time-ago'
import { toast } from '@/shared/ui/toaster'
import type { LibraryItemListView } from '@/features/library/public'
import { PrereqLockBadge } from './prereq-lock-badge'

/**
 * Variante locked de `<LibraryItemRow>` para items en categorías
 * `kind === 'COURSE'` cuyo prereq el viewer no completó todavía.
 *
 * Mismo layout que el row normal pero con opacity reducida + badge
 * candado al lado del título. Click NO navega — dispara toast con
 * acción "Ir a [prereq]".
 *
 * Decisión #D11 ADR `2026-05-04-library-courses-and-read-access.md`:
 *  - Sequential unlock se ve, no se oculta (transparencia).
 *  - Toast con CTA al prereq (no nav silent + no error).
 *
 * Client Component porque necesita useRouter para la action del toast
 * y para interceptar el click. El consumer (`<ItemList>`) decide
 * cuándo renderizar este vs el row normal.
 */
type Props = {
  item: LibraryItemListView
  /** Item prereq incompleto que bloquea este. URL canónica + título
   *  para el copy del toast. */
  prereq: {
    title: string
    categorySlug: string
    postSlug: string
  }
  /** Border-t hairline cuando se renderiza fuera de un wrapper
   *  con `divide-y`. Default `false`. */
  hairline?: boolean
}

export function LibraryItemLockedRow({ item, prereq, hairline = false }: Props): React.ReactNode {
  const router = useRouter()

  function handleClick(e: React.MouseEvent<HTMLButtonElement>): void {
    e.preventDefault()
    toast(`Completá "${prereq.title}" antes de abrir esto.`, {
      action: {
        label: `Ir a "${prereq.title}"`,
        onClick: () => router.push(`/library/${prereq.categorySlug}/${prereq.postSlug}`),
      },
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${item.title} (bloqueado: completá ${prereq.title} primero)`}
      className={[
        'flex w-full items-center gap-3 px-3 py-3 text-left opacity-60 hover:bg-soft motion-safe:transition-colors',
        hairline ? 'border-t-[0.5px] border-border first:border-t-0' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg text-xl"
      >
        {item.categoryEmoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-body text-sm font-semibold text-text">
          <span className="truncate">{item.title}</span>
          <PrereqLockBadge prereqTitle={prereq.title} />
        </p>
        <p className="mt-0.5 truncate font-body text-[12px] text-muted">
          <span>{item.categoryTitle}</span>
          <span aria-hidden="true"> · </span>
          <span>{item.authorDisplayName}</span>
          <span aria-hidden="true"> · </span>
          <TimeAgo date={item.lastActivityAt} />
        </p>
      </div>
    </button>
  )
}
