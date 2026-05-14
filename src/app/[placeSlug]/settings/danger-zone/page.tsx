import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowRightLeft, DoorOpen } from 'lucide-react'
import { getCurrentAuthUser } from '@/shared/lib/auth-user'
import { loadPlaceBySlug } from '@/shared/lib/place-loader'
import { clientEnv } from '@/shared/config/env'
import { PageHeader } from '@/shared/ui/page-header'
import { LeaveSystemPanel } from '@/features/members/profile/public'
import { findMemberPermissions, listActiveMembers } from '@/features/members/public.server'
import { TransferOwnershipPanel } from '@/features/places/public'

export const metadata: Metadata = {
  title: 'Zona de peligro · Settings',
}

type Props = { params: Promise<{ placeSlug: string }> }

/**
 * Zona de peligro del place — acciones irreversibles sobre la relación
 * user ↔ place. Renombre 2026-05-14 (era `/settings/system` / "Permanencia").
 *
 * Las dos secciones se diferencian visualmente por **severidad**:
 *
 *  - **Transferir ownership** (owner-only) — card neutral con icono ↔.
 *    Transformacional pero no destructiva por default (queda co-ownership).
 *    Trigger abre `<TransferOwnershipSheet>` (panel responsive + form).
 *  - **Salir del place** (cualquier miembro) — card destacada red/amber con
 *    icono puerta. Acción irreversible (contenido queda 365d antes de
 *    anonimizar). Trigger abre `<LeavePlaceDialog>` (confirm modal).
 *
 * Ambas acciones ahora viven detrás de un trigger button + modal —
 * el form de transfer ya NO es inline directo (era idéntico visualmente
 * al de salir, generaba confusión).
 *
 * El gate admin/owner del `/settings/*` layout NO restringe esta sub-page —
 * cualquier miembro debe poder salir.
 *
 * Ver `docs/decisions/2026-05-12-settings-system-for-lifecycle.md`.
 */
export default async function SettingsDangerZonePage({ params }: Props) {
  const { placeSlug } = await params

  const auth = await getCurrentAuthUser()
  const actorId = auth!.id

  const place = await loadPlaceBySlug(placeSlug)
  if (!place || place.archivedAt) {
    notFound()
  }

  const perms = await findMemberPermissions(actorId, place.id)
  const transferCandidates = perms.isOwner
    ? (await listActiveMembers(place.id))
        .filter((m) => m.userId !== actorId)
        .map((m) => ({
          userId: m.userId,
          displayName: m.user.displayName,
          handle: m.user.handle,
        }))
    : []

  return (
    <div className="mx-auto max-w-screen-md space-y-6 px-3 py-6 md:px-4 md:py-8">
      <PageHeader
        title="Zona de peligro"
        description="Acciones irreversibles sobre tu permanencia en el place."
      />

      {perms.isOwner ? (
        <section
          aria-labelledby="transfer-ownership-heading"
          className="space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-4 md:p-5"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-neutral-700 ring-1 ring-neutral-200"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 id="transfer-ownership-heading" className="font-serif text-lg text-neutral-900">
                Transferir ownership
              </h2>
              <p className="mt-1 text-sm text-neutral-700">
                Pasá la ownership del place a otro miembro activo. Por default mantenés tu membresía
                (queda co-ownership); podés también salir en el mismo paso.
              </p>
            </div>
          </div>
          <TransferOwnershipPanel placeSlug={place.slug} candidates={transferCandidates} />
        </section>
      ) : null}

      <section
        aria-labelledby="leave-heading"
        className="space-y-3 rounded-md border border-red-200 bg-red-50/40 p-4 md:p-5"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-red-700 ring-1 ring-red-200"
          >
            <DoorOpen className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 id="leave-heading" className="font-serif text-lg text-red-900">
              Salir del place
            </h2>
            <p className="mt-1 text-sm text-red-900/85">
              Tu acceso se cierra. Tu contenido queda atribuido 365 días antes de anonimizarse. Si
              sos el único owner, transferí ownership primero — el dialog te avisa antes.
            </p>
          </div>
        </div>
        <LeaveSystemPanel placeSlug={place.slug} appUrl={clientEnv.NEXT_PUBLIC_APP_URL} />
      </section>
    </div>
  )
}
