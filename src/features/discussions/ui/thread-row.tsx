import Link from 'next/link'
import { MemberAvatar } from '@/features/members/public'
import { TimeAgo } from '@/shared/ui/time-ago'
import type { PostListView } from '../domain/types'
import { ReaderStack } from './reader-stack'
import { PostUnreadDot } from './post-unread-dot'
import { isDormant } from '../domain/invariants'

/**
 * Row simple de un thread en la lista (R.6) — usado para todos los
 * posts excepto el primero (que va en `<FeaturedThreadCard>`).
 *
 * Layout (handoff threads/):
 *  - Sin card chrome (no border individual). Padding 14px vertical /
 *    12px horizontal. El divider hairline entre rows lo manda el
 *    contenedor `<ThreadList>` con `divide-y divide-border`.
 *  - Author row: MemberAvatar 24×24 + nombre + tiempo.
 *  - Título Fraunces 17 con dot unread inline.
 *  - Snippet 1 line clamp.
 *  - Footer: ReaderStack 3 readers + count "{n} respuestas {N}
 *    lectores" sin bold.
 *
 * Full-row tap target via `<Link>`. Posts dormidos opacity reducida.
 *
 * Server Component puro.
 *
 * Ver `docs/features/discussions/spec.md` § 21.1.
 */
export function ThreadRow({ post }: { post: PostListView }): React.ReactNode {
  const dormant = isDormant(post.lastActivityAt, new Date())
  const lastReadMs = post.lastReadAt ? new Date(post.lastReadAt).getTime() : 0
  const hasUnread = new Date(post.lastActivityAt).getTime() > lastReadMs
  const authorUserId = post.authorUserId ?? `ex-${post.id}`
  // Para el footer: si el post tiene readers, mostramos "respuestas + lectores";
  // sino solo "respuestas".
  const readerCount = post.readerSample.length

  return (
    <article className={dormant ? 'opacity-75' : ''}>
      <Link
        href={`/conversations/${post.slug}`}
        className="block px-3 py-3.5 focus:outline-none focus-visible:bg-soft"
      >
        <header className="flex items-center gap-2">
          <MemberAvatar
            userId={authorUserId}
            displayName={post.authorSnapshot.displayName}
            avatarUrl={post.authorSnapshot.avatarUrl}
            size={24}
          />
          <span className="font-body text-[13px] font-medium text-text">
            {post.authorSnapshot.displayName}
          </span>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <TimeAgo date={post.lastActivityAt} className="text-[13px] text-muted" />
        </header>
        <h3 className="mt-1.5 flex items-center gap-2 font-title text-[17px] font-semibold leading-snug text-text">
          <span>{post.title}</span>
          {hasUnread ? <PostUnreadDot /> : null}
        </h3>
        {post.snippet ? (
          <p className="mt-0.5 line-clamp-1 font-body text-[13.5px] text-muted">{post.snippet}</p>
        ) : null}
        {readerCount > 0 || post.commentCount > 0 ? (
          <footer className="mt-2 flex items-center gap-3">
            {readerCount > 0 ? <ReaderStack readers={post.readerSample} max={3} size={20} /> : null}
            <span className="font-body text-xs text-muted">
              {post.commentCount === 1 ? '1 respuesta' : `${post.commentCount} respuestas`}
            </span>
          </footer>
        ) : null}
      </Link>
    </article>
  )
}
