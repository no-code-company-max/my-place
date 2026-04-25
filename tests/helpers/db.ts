/**
 * Queries Prisma utilizadas por specs E2E. Scaffolding-only: bypassea la app
 * layer para leer IDs y estado intermedio que la UI no expone directamente
 * (ej: resolver postId a partir de slug, contar reactions de un comment).
 */

import { getTestPrisma as getPrisma } from './prisma'

export async function findPostIdBySlug(placeId: string, slug: string): Promise<string> {
  const post = await getPrisma().post.findUnique({
    where: { placeId_slug: { placeId, slug } },
    select: { id: true },
  })
  if (!post) throw new Error(`[tests/helpers/db] Post no encontrado: ${placeId}/${slug}`)
  return post.id
}

export async function findInvitationTokenByEmail(placeId: string, email: string): Promise<string> {
  const invitation = await getPrisma().invitation.findFirst({
    where: { placeId, email: email.toLowerCase(), acceptedAt: null },
    orderBy: { lastSentAt: 'desc' },
    select: { token: true },
  })
  if (!invitation) {
    throw new Error(
      `[tests/helpers/db] Invitación pendiente no encontrada para ${email} en ${placeId}`,
    )
  }
  return invitation.token
}

export async function setPlaceClosedByKey(placeId: string): Promise<void> {
  await getPrisma().place.update({
    where: { id: placeId },
    data: { openingHours: { kind: 'unconfigured' } },
  })
}

export async function setPlaceAlwaysOpen(placeId: string): Promise<void> {
  await getPrisma().place.update({
    where: { id: placeId },
    data: {
      openingHours: {
        kind: 'always_open',
        timezone: 'America/Argentina/Buenos_Aires',
      },
    },
  })
}

export async function countReactionsOfTarget(
  targetType: 'POST' | 'COMMENT',
  targetId: string,
): Promise<number> {
  return getPrisma().reaction.count({ where: { targetType, targetId } })
}

/**
 * Crea un Comment en el place con autor del E2E seed. Retorna el commentId.
 * Bypassea la action layer — usado sólo para setup de specs que testean
 * otras acciones (ej: reaccionar a un comment que ya existe).
 */
export async function createTestPost(opts: {
  placeId: string
  authorUserId: string
  slug: string
  title?: string
  backdate?: string
}): Promise<string> {
  const post = await getPrisma().post.create({
    data: {
      placeId: opts.placeId,
      authorUserId: opts.authorUserId,
      authorSnapshot: { displayName: 'E2E Spec Author', avatarUrl: null },
      title: opts.title ?? 'Post creado por spec',
      slug: opts.slug,
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: opts.title ?? 'Post creado por spec.' }],
          },
        ],
      },
    },
    select: { id: true },
  })
  if (opts.backdate) {
    await getPrisma().$executeRawUnsafe(
      `UPDATE "Post" SET "createdAt" = "createdAt" - INTERVAL '${opts.backdate}' WHERE id = $1`,
      post.id,
    )
  }
  return post.id
}

export async function deletePostById(postId: string): Promise<void> {
  await getPrisma()
    .post.delete({ where: { id: postId } })
    .catch(() => {})
}

export async function deletePostBySlug(placeId: string, slug: string): Promise<void> {
  await getPrisma()
    .post.delete({ where: { placeId_slug: { placeId, slug } } })
    .catch(() => {})
}

export async function createTestComment(opts: {
  postId: string
  placeId: string
  authorUserId: string
  body?: string
}): Promise<string> {
  const comment = await getPrisma().comment.create({
    data: {
      postId: opts.postId,
      placeId: opts.placeId,
      authorUserId: opts.authorUserId,
      authorSnapshot: { displayName: 'E2E Comment Author', avatarUrl: null },
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: opts.body ?? 'Comentario seedeado para el spec.' }],
          },
        ],
      },
    },
    select: { id: true },
  })
  return comment.id
}

export async function deleteCommentsByPost(postId: string): Promise<void> {
  await getPrisma().reaction.deleteMany({
    where: { targetType: 'COMMENT', targetId: { startsWith: '' } },
  })
  await getPrisma().comment.deleteMany({ where: { postId } })
}

export async function findUserIdByEmail(email: string): Promise<string> {
  const user = await getPrisma().user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (!user) throw new Error(`[tests/helpers/db] User no encontrado: ${email}`)
  return user.id
}

export async function deleteEventsByPlace(placeId: string): Promise<void> {
  // Eventos creados por F.D smoke specs. EventRSVP cascadea por FK.
  // El thread auto-creado (Post) queda asociado vía Event.postId; lo
  // borramos también para no acumular en /conversations entre runs.
  const events = await getPrisma().event.findMany({
    where: { placeId },
    select: { id: true, postId: true },
  })
  await getPrisma().event.deleteMany({ where: { placeId } })
  const postIds = events.map((e) => e.postId).filter((x): x is string => x !== null)
  if (postIds.length > 0) {
    await getPrisma().post.deleteMany({ where: { id: { in: postIds } } })
  }
}

export async function findEventIdByTitle(placeId: string, title: string): Promise<string | null> {
  const event = await getPrisma().event.findFirst({
    where: { placeId, title },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })
  return event?.id ?? null
}

export async function deleteFlagsByPlace(placeId: string): Promise<void> {
  await getPrisma().flag.deleteMany({ where: { placeId } })
}

export async function countFlagsByTarget(
  targetType: 'POST' | 'COMMENT',
  targetId: string,
): Promise<number> {
  return getPrisma().flag.count({ where: { targetType, targetId } })
}

export async function deleteInvitationsByEmail(placeId: string, email: string): Promise<void> {
  await getPrisma().invitation.deleteMany({
    where: { placeId, email: email.toLowerCase() },
  })
}

export { closeTestPrisma as closeDbHelperPrisma } from './prisma'
