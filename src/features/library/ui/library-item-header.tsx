import Link from 'next/link'
import { TimeAgo } from '@/shared/ui/time-ago'
import { MemberAvatar } from '@/features/members/public'
import type { LibraryItemDetailView } from '@/features/library/public'

type Props = {
  item: LibraryItemDetailView
}

/**
 * Header del item detail (R.7.9): chip de categoría (link a su
 * listado) + título Fraunces + author chip + meta (createdAt).
 *
 * El cover (`item.coverUrl`) NO se renderiza en mobile (decisión user
 * 2026-04-30 — la columna mobile no se beneficia visualmente del
 * cover). Reservado para layout desktop futuro.
 *
 * Server Component puro.
 */
export function LibraryItemHeader({ item }: Props): React.ReactNode {
  return (
    <header className="px-3 pb-2 pt-4">
      <Link
        href={`/library/${item.categorySlug}`}
        className="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border bg-surface px-2.5 py-1 text-xs text-muted hover:text-text"
      >
        <span aria-hidden>{item.categoryEmoji}</span>
        <span>{item.categoryTitle}</span>
      </Link>

      <h1 className="mt-3 font-title text-[28px] font-bold leading-tight tracking-[-0.6px] text-text">
        {item.title}
      </h1>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        {item.authorUserId ? (
          <Link
            href={`/m/${item.authorUserId}`}
            className="flex items-center gap-2 hover:text-text"
          >
            <MemberAvatar
              userId={item.authorUserId}
              displayName={item.authorSnapshot.displayName}
              avatarUrl={item.authorSnapshot.avatarUrl}
              size={20}
            />
            <span>{item.authorSnapshot.displayName}</span>
          </Link>
        ) : (
          <span className="italic">{item.authorSnapshot.displayName}</span>
        )}
        <span aria-hidden>·</span>
        <TimeAgo date={item.postCreatedAt} />
        {item.archivedAt ? (
          <>
            <span aria-hidden>·</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Archivado</span>
          </>
        ) : null}
      </div>
    </header>
  )
}
