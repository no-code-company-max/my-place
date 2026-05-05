import 'server-only'
import { revalidatePath } from 'next/cache'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/db/client'
import { RESERVED_POST_SLUGS, generatePostSlug } from '@/features/discussions/domain/slug'

/**
 * Revalida las rutas afectadas por un cambio sobre un post específico.
 *
 * Todos los verbos (create/edit/delete/moderate) impactan el listing porque
 * la vista del post visible (title/snippet/visibility/presencia en la lista)
 * cambia con cada uno — no se puede reducir como en comments.
 *
 * NO revalidamos `/${placeSlug}` (la home): hoy es un placeholder estático
 * (Fase 7 del roadmap) que no consume queries de discussions. Cuando llegue
 * la portada real, se evalúa qué necesita revalidate.
 *
 * Helper server-only (sin `'use server'`) consumido por los action files del
 * directorio. Los actions mantienen su propio `'use server'` al tope.
 */
export function revalidatePostPaths(placeSlug: string, postSlug?: string): void {
  revalidatePath(`/${placeSlug}/conversations`)
  if (postSlug) revalidatePath(`/${placeSlug}/conversations/${postSlug}`)
}

/**
 * Cliente Prisma utilizable por helpers server. Acepta tanto el singleton
 * (`prisma`) como un `Prisma.TransactionClient` recibido dentro de un
 * `prisma.$transaction(...)`. Imprescindible para `createPostFromSystemHelper`
 * (events) que vive bajo la tx atómica de `createEventAction`.
 */
export type PostClient = PrismaClient | Prisma.TransactionClient

/**
 * Resuelve un slug único dentro de un place. Lee las colisiones existentes que
 * empiezan con el mismo prefijo y construye el reserved set combinado.
 *
 * Parametrizado por cliente para soportar invocación tanto desde
 * `createPostAction` (singleton `prisma`) como desde `createPostFromSystemHelper`
 * (cliente transaccional). Default = singleton para no romper callers
 * existentes.
 */
export async function resolveUniqueSlug(
  placeId: string,
  title: string,
  client: PostClient = prisma,
): Promise<string> {
  const base = generatePostSlug(title, { reserved: new Set() })
  const existing = await client.post.findMany({
    where: { placeId, slug: { startsWith: base } },
    select: { slug: true },
  })
  const reserved = new Set<string>([...RESERVED_POST_SLUGS, ...existing.map((e) => e.slug)])
  return generatePostSlug(title, { reserved })
}
