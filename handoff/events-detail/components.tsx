/**
 * EVENT DETAIL components — reference. Translate inline → Tailwind.
 */

import * as React from 'react'

type Author = { id: string; name: string; initials: string; color: string }
type Attendee = { id: string; initials: string; color: string }

// ─── Hero ─────────────────────────────────────────────────────────────────

export function EventHero({ imageUrl, emoji }: { imageUrl?: string; emoji: string }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        style={{
          display: 'block',
          width: '100%',
          height: 220,
          objectFit: 'cover',
        }}
      />
    )
  }
  return (
    <div
      style={{
        height: 120,
        width: '100%',
        background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 48,
        lineHeight: 1,
      }}
    >
      {emoji}
    </div>
  )
}

// ─── Meta block ───────────────────────────────────────────────────────────

export function EventMeta({
  startsAt,
  title,
  location,
  durationMin,
  price,
  currency = 'ARS',
}: {
  startsAt: Date
  title: string
  location: { label: string; mapsHref?: string }
  durationMin: number
  price?: number
  currency?: string
}) {
  return (
    <div style={{ padding: '18px 16px 0' }}>
      <div
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--accent)',
          marginBottom: 4,
        }}
      >
        {formatEventDate(startsAt)}
      </div>
      <h1
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          textWrap: 'balance' as any,
          margin: '0 0 14px',
          color: 'var(--text)',
        }}
      >
        {title}
      </h1>

      <MetaRow icon="📍" link={location.mapsHref}>
        {location.label}
      </MetaRow>
      <MetaRow icon="⏱">{formatDuration(durationMin)}</MetaRow>
      {price != null && <MetaRow icon="💰">{formatPrice(price, currency)} por persona</MetaRow>}
    </div>
  )
}

function MetaRow({
  icon,
  children,
  link,
}: {
  icon: string
  children: React.ReactNode
  link?: string
}) {
  const inner = (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '4px 0',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1, width: 16, textAlign: 'center' }}>{icon}</span>
      <span
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 15,
          color: 'var(--text)',
        }}
      >
        {children}
      </span>
    </div>
  )
  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        {inner}
      </a>
    )
  }
  return inner
}

// ─── Description ──────────────────────────────────────────────────────────

export function EventDescription({ body }: { body: string }) {
  return (
    <section style={{ padding: '0 16px' }}>
      <Divider />
      <h2 style={sectionHeading}>Sobre el evento</h2>
      <p
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 15.5,
          lineHeight: 1.55,
          color: 'var(--text)',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}
      >
        {body}
      </p>
    </section>
  )
}

// ─── Host ─────────────────────────────────────────────────────────────────

export function EventHost({ host }: { host: Author }) {
  return (
    <section style={{ padding: '0 16px' }}>
      <Divider />
      <h2 style={sectionHeading}>Anfitrión</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: host.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, system-ui',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {host.initials}
        </div>
        <div>
          <div
            style={{
              fontFamily: 'Inter, system-ui',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.2,
            }}
          >
            {host.name}
          </div>
          <div
            style={{
              fontFamily: 'Inter, system-ui',
              fontSize: 12,
              color: 'var(--muted)',
              marginTop: 2,
            }}
          >
            anfitrión
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Attendees ────────────────────────────────────────────────────────────

export function EventAttendees({ attendees, total }: { attendees: Attendee[]; total: number }) {
  const visible = attendees.slice(0, 8)
  const overflow = total - visible.length
  return (
    <section style={{ padding: '0 16px 18px' }}>
      <Divider />
      <h2 style={sectionHeading}>
        Asistentes <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({total})</span>
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex' }}>
          {visible.map((a, i) => (
            <div
              key={a.id}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: a.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter, system-ui',
                fontWeight: 700,
                fontSize: 11,
                border: '1.5px solid var(--bg)',
                marginLeft: i === 0 ? 0 : -8,
              }}
            >
              {a.initials}
            </div>
          ))}
        </div>
        {overflow > 0 && (
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--soft)',
              fontFamily: 'Inter, system-ui',
              fontWeight: 600,
              fontSize: 11,
              color: 'var(--muted)',
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── RSVP bar ─────────────────────────────────────────────────────────────

export function RsvpBar({
  status,
  onSet,
}: {
  status: 'going' | 'maybe' | null
  onSet: (s: 'going' | 'maybe' | null) => void
}) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        background: 'var(--surface)',
        borderTop: '0.5px solid var(--border)',
        padding: '12px 12px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      }}
    >
      {status === null && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onSet('going')}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 999,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: 'Inter, system-ui',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Voy
          </button>
          <button
            onClick={() => onSet('maybe')}
            aria-label="Tal vez"
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: 'var(--surface)',
              border: '0.5px solid var(--border)',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            🤔
          </button>
        </div>
      )}
      {status === 'going' && <ConfirmedRsvp label="✓  Vas a ir" onCancel={() => onSet(null)} />}
      {status === 'maybe' && (
        <ConfirmedRsvp label="🤔  Tal vez vayas" onCancel={() => onSet(null)} />
      )}
    </div>
  )
}

function ConfirmedRsvp({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <>
      <button
        style={{
          width: '100%',
          height: 48,
          borderRadius: 999,
          border: 'none',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          fontFamily: 'Inter, system-ui',
          fontWeight: 600,
          fontSize: 15,
          cursor: 'default',
        }}
      >
        {label}
      </button>
      <button
        onClick={onCancel}
        style={{
          display: 'block',
          margin: '6px auto 0',
          background: 'transparent',
          border: 'none',
          fontFamily: 'Inter, system-ui',
          fontSize: 13,
          color: 'var(--muted)',
          cursor: 'pointer',
          padding: 6,
        }}
      >
        Cancelar
      </button>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const sectionHeading: React.CSSProperties = {
  fontFamily: 'var(--title-font)',
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  margin: '0 0 8px',
  color: 'var(--text)',
}

function Divider() {
  return (
    <div
      style={{
        height: 0,
        borderTop: '0.5px solid var(--border)',
        margin: '18px 0',
      }}
    />
  )
}

function formatEventDate(d: Date): string {
  // "Sáb 12 abr · 19:00"
  const day = d.toLocaleDateString('es-AR', { weekday: 'short' })
  const date = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const cap = day.charAt(0).toUpperCase() + day.slice(1)
  return `${cap.replace('.', '')} ${date} · ${time}`
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`
  return `${h}h ${m}min`
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `$${amount}`
  }
}
