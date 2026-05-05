import 'server-only'
import { getMailer, type SendResult } from '@/shared/lib/mailer'

/**
 * Wrapper canónico del slice `members` para enviar el aviso de desbloqueo.
 * Plan G.4 — PermissionGroups.
 *
 * `message` opcional — el actor puede enviar un texto breve adicional.
 * Sin texto, el template queda con el subject + cuerpo standard
 * "Tu acceso fue restaurado".
 */
export async function sendUnblockEmail(params: {
  to: string
  placeName: string
  message: string | null
  contactEmail: string
}): Promise<SendResult> {
  const mailer = getMailer()
  return mailer.sendUnblockNotice(params)
}
