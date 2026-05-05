/**
 * THREADS components — reference. Translate inline → Tailwind.
 */

import * as React from 'react'

export type Thread = {
  id: string
  authorId: string
  authorName: string
  authorInitials: string
  authorColor: string
  createdAt: Date
  title: string
  snippet: string
  replies: number
  readerIds: string[]
  featured?: boolean
}

type Reader = { id: string; initials: string; color: string }

// ─── Section header ───────────────────────────────────────────────────────

export function ThreadsHeader() {
  return (
    <div style={{ padding: '24px 12px 0', display: 'flex', gap: 18, alignItems: 'center' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          lineHeight: 1,
        }}
      >
        💬
      </div>
      <h1
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          margin: 0,
          color: 'var(--text)',
        }}
      >
        Discusiones
      </h1>
    </div>
  )
}

// ─── Filter row ───────────────────────────────────────────────────────────

export function ThreadFilterBar({
  filter,
  onChange,
}: {
  filter: 'all' | 'unanswered' | 'mine'
  onChange: (f: 'all' | 'unanswered' | 'mine') => void
}) {
  const items: { id: typeof filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'unanswered', label: 'Sin respuesta' },
    { id: 'mine', label: 'En los que participo' },
  ]
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: 6,
        padding: '14px 12px 4px',
        overflowX: 'auto',
      }}
    >
      {items.map((it) => {
        const active = it.id === filter
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              fontFamily: 'Inter, system-ui',
              fontSize: 13,
              fontWeight: 500,
              background: active ? 'var(--text)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--muted)',
              border: active ? 'none' : '0.5px solid var(--border)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Featured thread (full card) ──────────────────────────────────────────

export function FeaturedThread({
  t,
  readers,
  href,
}: {
  t: Thread
  readers: Reader[]
  href: string
}) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        margin: '14px 12px 0',
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 18,
        padding: 18,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Author
        author={{ initials: t.authorInitials, color: t.authorColor, name: t.authorName }}
        createdAt={t.createdAt}
      />
      <h2
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.2,
          margin: '12px 0 6px',
          color: 'var(--text)',
        }}
      >
        {t.title}
      </h2>
      <p
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 14,
          lineHeight: 1.45,
          color: 'var(--muted)',
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {t.snippet}
      </p>
      <Footer readers={readers} replies={t.replies} />
    </a>
  )
}

// ─── Thread row (no card) ─────────────────────────────────────────────────

export function ThreadRow({ t, readers, href }: { t: Thread; readers: Reader[]; href: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'block',
        padding: '14px 12px',
        borderTop: '0.5px solid var(--border)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Author
        author={{ initials: t.authorInitials, color: t.authorColor, name: t.authorName }}
        createdAt={t.createdAt}
      />
      <h3
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          margin: '6px 0 2px',
          color: 'var(--text)',
        }}
      >
        {t.title}
      </h3>
      <p
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 13.5,
          color: 'var(--muted)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {t.snippet}
      </p>
      <Footer readers={readers} replies={t.replies} />
    </a>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Author({
  author,
  createdAt,
}: {
  author: { initials: string; color: string; name: string }
  createdAt: Date
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: author.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui',
          fontWeight: 700,
          fontSize: 11,
        }}
      >
        {author.initials}
      </div>
      <span
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text)',
        }}
      >
        {author.name}
      </span>
      <span style={{ fontFamily: 'Inter, system-ui', fontSize: 12, color: 'var(--muted)' }}>
        · {formatRelative(createdAt)}
      </span>
    </div>
  )
}

function Footer({ readers, replies }: { readers: Reader[]; replies: number }) {
  return (
    <div
      style={{
        marginTop: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <ReaderStack readers={readers.slice(0, 4)} />
      <span style={{ fontFamily: 'Inter, system-ui', fontSize: 12, color: 'var(--muted)' }}>
        {replies} {replies === 1 ? 'respuesta' : 'respuestas'}
      </span>
    </div>
  )
}

export function ReaderStack({ readers }: { readers: Reader[] }) {
  return (
    <div style={{ display: 'flex' }}>
      {readers.map((r, i) => (
        <div
          key={r.id}
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: r.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, system-ui',
            fontWeight: 700,
            fontSize: 9,
            border: '1.5px solid var(--bg)',
            marginLeft: i === 0 ? 0 : -6,
          }}
        >
          {r.initials}
        </div>
      ))}
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime()
  const h = Math.round(diff / 36e5)
  if (h < 1) return 'hace minutos'
  if (h < 24) return `hace ${h} h`
  const days = Math.round(h / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} d`
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}
