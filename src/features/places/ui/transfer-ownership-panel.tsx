'use client'

import { useState } from 'react'
import { TransferOwnershipSheet } from './transfer-ownership-sheet'

type Candidate = {
  userId: string
  displayName: string
  handle: string | null
}

type Props = {
  placeSlug: string
  candidates: Candidate[]
}

/**
 * Client wrapper para montar `<TransferOwnershipSheet>` (panel responsive)
 * con un button trigger propio. Análogo a `<LeaveSystemPanel>` en
 * `members/ui/leave-system-panel.tsx`: el page padre es Server Component
 * y este wrapper maneja el `useState` del overlay sin contaminarlo con
 * `'use client'`.
 *
 * El sheet ya valida internamente la lista de candidates + dispara
 * `transferOwnershipAction`. Sin candidatos posibles, el button queda
 * disabled para comunicar el blocker antes del tap (en vez de mostrar
 * el empty state recién al abrir).
 *
 * Diferenciado visualmente del button de "Salir": neutral, no red — la
 * transferencia es transformacional pero no destructiva (queda co-ownership
 * por default; solo se sale si el user marca el checkbox).
 */
export function TransferOwnershipPanel({ placeSlug, candidates }: Props): React.ReactNode {
  const [open, setOpen] = useState(false)
  const noCandidates = candidates.length === 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={noCandidates}
        title={noCandidates ? 'Necesitás otros miembros activos para transferir.' : undefined}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Transferir ownership
      </button>
      <TransferOwnershipSheet
        open={open}
        onOpenChange={setOpen}
        placeSlug={placeSlug}
        candidates={candidates}
      />
    </>
  )
}
