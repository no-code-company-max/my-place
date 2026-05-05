import 'server-only'
import { getMailer, type SendResult } from '@/shared/lib/mailer'

/**
 * Wrapper canónico del slice `members` para enviar el aviso de bloqueo.
 * Plan G.4 — PermissionGroups.
 *
 * Sigue el patrón de `actions/shared.ts:deliverInvitationEmail`: la action
 * de bloqueo no llama al `Mailer` directo. Pasa por acá para que la action
 * sólo conozca un único helper y sea testeable inyectando `setMailer(fake)`.
 *
 * **No maneja errores**: el caller (la action) los envuelve en try/catch
 * porque la decisión de "commit del bloqueo aunque el email falle" es de
 * negocio, no del mailer (decisión #9 ADR PermissionGroups).
 */
export async function sendBlockEmail(params: {
  to: string
  placeName: string
  reason: string
  contactEmail: string
}): Promise<SendResult> {
  const mailer = getMailer()
  return mailer.sendBlockNotice(params)
}
