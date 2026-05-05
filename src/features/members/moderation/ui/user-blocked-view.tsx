/**
 * Vista renderizada por el gate `(gated)/layout.tsx` cuando el viewer es
 * miembro activo PERO tiene `Membership.blockedAt IS NOT NULL`. Plan G.4 —
 * PermissionGroups (decisión #12 ADR — bloqueo más específico que horario).
 *
 * Server Component intencionalmente. No tiene interactividad: el user
 * bloqueado sólo puede leer el motivo + email de contacto. Sin links,
 * sin nav, sin CTAs — el bloqueo es un estado terminal hasta que un
 * admin lo desbloquee.
 *
 * Tono coherente con `<PlaceClosedView>` y el resto del producto: sin
 * urgencia, sin gritos, sin ansiedad. Un mensaje sereno con la info
 * mínima necesaria.
 */

type Props = {
  placeName: string
  blockedReason: string | null
  blockedContactEmail: string | null
}

export function UserBlockedView({ placeName, blockedReason, blockedContactEmail }: Props) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-lg border p-8"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
        }}
      >
        <h1 className="font-serif text-2xl italic">Estás bloqueado de {placeName}</h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Un administrador del place restringió tu acceso. Mientras esté así, no vas a poder entrar.
        </p>

        {blockedReason ? (
          <section className="mt-6">
            <h2 className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Motivo
            </h2>
            <p
              className="mt-1 whitespace-pre-wrap rounded border-l-2 px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              {blockedReason}
            </p>
          </section>
        ) : null}

        {blockedContactEmail ? (
          <section className="mt-6">
            <h2 className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Contacto
            </h2>
            <p className="mt-1 text-sm">
              Si querés discutirlo, escribí a{' '}
              <a
                href={`mailto:${blockedContactEmail}`}
                className="underline"
                style={{ color: 'var(--text)' }}
              >
                {blockedContactEmail}
              </a>
              .
            </p>
          </section>
        ) : null}
      </div>
    </main>
  )
}
