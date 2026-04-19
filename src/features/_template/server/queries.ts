import 'server-only'
import { prisma } from '@/db/client'
import type { TemplateEntity } from '../domain/types'

/**
 * Queries a DB de este slice. Server-only (no puede llegar al bundle cliente).
 * Solo este archivo (y `actions.ts`) pueden importar `prisma`.
 */

export async function getTemplateById(_id: string): Promise<TemplateEntity | null> {
  // Reemplazar por query real al copiar este template.
  void prisma
  return null
}
