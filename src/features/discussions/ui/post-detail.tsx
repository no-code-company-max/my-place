import Link from 'next/link'
import { MemberAvatar } from '@/features/members/public'
import type { Post } from '../domain/types'
import { TimeAgo } from '@/shared/ui/time-ago'
import { FlagButton } from '@/features/flags/public'
import { EditWindowActions } from './edit-window-actions'
import { RichTextRenderer, type MentionResolvers } from '@/features/rich-text/public.server'

/**
 * Header + body del post (R.6.4 layout, ajustado 2026-04-27).
 *
 * Orden visual:
 *  - h1 título (Fraunces 28).
 *  - Body con RichTextRenderer.
 *  - **AuthorRow al fondo** del post (avatar + nombre + tiempo) —
 *    movido desde arriba del título por feedback visual. Mismo
 *    patrón que `<OrganizerRow>` en event-threads: identidad
 *    contextual al final del contenido, no titular.
 *  - FlagButton (a la derecha, sólo si no es el author).
 *  - EditWindowActions inline (autor + ventana 60s abierta).
 *
 * Sesión 4 (perf): la `ReactionBar(POST)` salió de este componente y
 * vive ahora dentro de `<CommentsSection>` (Suspense child) — la
 * agregación de reactions del POST se combina con la de los comments
 * en una sola query batched, ahorrando 2 RTTs del shell critical path.
 *
 * El kebab admin (`<PostAdminMenu>`) vive en el `<ThreadHeaderBar>`
 * (slot derecho) compuesto por la page; PostDetail intencionalmente
 * NO lo monta para evitar duplicado.
 */
export function PostDetail({
  post,
  viewerUserId,
  placeSlug,
  mentionResolvers,
}: {
  post: Post
  viewerUserId: string
  placeSlug: string
  /**
   * Resolvers inyectados por la page consumer — el slice `rich-text` no
   * importa de `members/`, `events/` ni `library/`; la page que sí
   * puede los construye.
   */
  mentionResolvers: MentionResolvers
}): React.ReactNode {
  const isAuthor = post.authorUserId !== null && post.authorUserId === viewerUserId

  return (
    <article className="space-y-4 px-3 pt-4">
      <header className="space-y-2">
        <h1 className="font-title text-[28px] font-bold leading-tight text-text">{post.title}</h1>
        {post.hiddenAt ? (
          <p className="inline-block rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
            Oculto — sólo admins lo ven
          </p>
        ) : null}
      </header>

      {post.body ? (
        <div className="font-body text-[15.5px] leading-[1.65] text-text">
          <RichTextRenderer document={post.body} resolvers={mentionResolvers} />
        </div>
      ) : null}

      <AuthorRow post={post} />

      {!isAuthor ? (
        <div className="flex justify-end">
          <FlagButton targetType="POST" targetId={post.id} />
        </div>
      ) : null}

      {isAuthor ? (
        <EditWindowActions
          subject={{
            kind: 'post',
            postId: post.id,
            title: post.title,
            body: post.body,
            createdAt: post.createdAt,
            version: post.version,
            placeSlug,
          }}
        />
      ) : null}
    </article>
  )
}

/**
 * Fila de autor al pie del post: avatar 28×28 + nombre + tiempo
 * relativo + (editado) opcional. Defensive: ex-miembro
 * (authorUserId null tras erasure 365d) → div no-link, avatar usa
 * colorKey fallback `ex-${postId}`.
 *
 * Mismo patrón visual que `<OrganizerRow>` en `<EventMetadataHeader>`
 * — identidad al final del contenido, silenciosa pero accesible.
 */
function AuthorRow({ post }: { post: Post }): React.ReactNode {
  const isExMember = post.authorUserId === null
  const colorKey = post.authorUserId ?? `ex-${post.id}`

  const inner = (
    <>
      <MemberAvatar
        userId={colorKey}
        displayName={post.authorSnapshot.displayName}
        avatarUrl={post.authorSnapshot.avatarUrl}
        size={28}
      />
      <span className="text-sm text-muted">
        <span className="font-medium text-text">{post.authorSnapshot.displayName}</span>
        <span aria-hidden="true"> · </span>
        <TimeAgo date={post.createdAt} />
        {post.editedAt ? (
          <>
            <span aria-hidden="true"> · </span>
            <span className="italic">(editado)</span>
          </>
        ) : null}
      </span>
    </>
  )

  if (isExMember) {
    return <div className="flex items-center gap-2.5">{inner}</div>
  }

  return (
    <Link
      href={`/m/${post.authorUserId}`}
      className="flex items-center gap-2.5 hover:opacity-80 motion-safe:transition-opacity"
    >
      {inner}
    </Link>
  )
}
