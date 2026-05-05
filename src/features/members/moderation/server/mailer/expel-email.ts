import 'server-only'
import { getMailer, type SendResult } from '@/shared/lib/mailer'

/**
 * Wrapper canónico del slice `members` para enviar el aviso de expulsión.
 * Plan G.4 — PermissionGroups.
 *
 * Owner-only en la action que lo invoca. El mailer no enforce eso: es
 * responsabilidad de `expelMemberAction`.
 */
export async function sendExpelEmail(params: {
  to: string
  placeName: string
  reason: string
  contactEmail: string
}): Promise<SendResult> {
  const mailer = getMailer()
  return mailer.sendExpelNotice(params)
}
