import Link from 'next/link'

/**
 * Empty state de la lista de threads (R.6).
 *
 * Cuando no hay posts en el place, mostramos un placeholder calmo:
 * emoji 🪶 (feather, ligereza) + título Fraunces + subtitle muted + CTA
 * primaria "Nueva discusión".
 *
 * Sin grito visual, sin badges de urgencia. Alineado con principios
 * "nada parpadea, nada grita" + "presencia silenciosa".
 *
 * Server Component puro.
 *
 * Ver `docs/features/discussions/spec.md` § 21.1 (empty state).
 */
export function EmptyThreads(): React.ReactNode {
  return (
    <div className="mx-3 flex flex-col items-center gap-3 rounded-[18px] border-[0.5px] border-border bg-surface px-6 py-10 text-center">
      <span aria-hidden="true" className="text-4xl leading-none">
        🪶
      </span>
      <h2 className="font-title text-[22px] font-bold text-text">Todavía nadie escribió</h2>
      <p className="max-w-[280px] font-body text-sm text-muted">
        Iniciá la conversación con un tema que te interese.
      </p>
      <Link
        href="/conversations/new"
        className="mt-2 rounded-full bg-text px-4 py-2 font-body text-[13px] font-medium text-bg hover:opacity-90 motion-safe:transition-opacity"
      >
        Nueva discusión
      </Link>
    </div>
  )
}
