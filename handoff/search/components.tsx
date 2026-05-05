/**
 * SEARCH components — reference. Translate inline → Tailwind.
 */

import * as React from 'react'

type SearchResult =
  | { type: 'event'; id: string; title: string; date: Date; emoji: string }
  | { type: 'thread'; id: string; title: string; replies: number }
  | { type: 'person'; id: string; name: string; initials: string; color: string }
  | {
      type: 'doc'
      id: string
      title: string
      categoryTitle: string
      docType: 'pdf' | 'image' | 'link' | 'doc' | 'sheet'
    }

type SearchResponse = {
  events: SearchResult[]
  threads: SearchResult[]
  people: SearchResult[]
  docs: SearchResult[]
}

// ─── Header ───────────────────────────────────────────────────────────────

export function SearchHeader({
  value,
  onChange,
  onClose,
  communityName,
}: {
  value: string
  onChange: (v: string) => void
  onClose: () => void
  communityName: string
}) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: 56,
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bg)',
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div style={{ flex: 1, position: 'relative' }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted)',
          }}
        >
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Buscar en ${communityName}…`}
          style={{
            width: '100%',
            height: 40,
            padding: value ? '0 38px 0 38px' : '0 12px 0 38px',
            borderRadius: 999,
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            fontFamily: 'Inter, system-ui',
            fontSize: 15,
            color: 'var(--text)',
            outline: 'none',
          }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            aria-label="Limpiar"
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 24,
              height: 24,
              borderRadius: 999,
              background: 'var(--soft)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: 12,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Section title ────────────────────────────────────────────────────────

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div
      style={{
        padding: '18px 12px 6px',
        fontFamily: 'Inter, system-ui',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'var(--muted)',
      }}
    >
      {children}
      {count != null && ` · ${count}`}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────

export function SearchEmpty({
  recents,
  onPickRecent,
  onRemoveRecent,
  onClearAll,
  onJumpSection,
}: {
  recents: string[]
  onPickRecent: (q: string) => void
  onRemoveRecent: (q: string) => void
  onClearAll: () => void
  onJumpSection: (s: 'events' | 'threads' | 'library') => void
}) {
  return (
    <div>
      {recents.length > 0 && (
        <>
          <SectionTitle>Recientes</SectionTitle>
          <div>
            {recents.map((r, i) => (
              <div
                key={r}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
                }}
              >
                <button
                  onClick={() => onPickRecent(r)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      background: 'var(--soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.8" />
                      <path
                        d="M20 20l-3.5-3.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span
                    style={{ fontFamily: 'Inter, system-ui', fontSize: 14, color: 'var(--text)' }}
                  >
                    {r}
                  </span>
                </button>
                <button
                  onClick={() => onRemoveRecent(r)}
                  aria-label="Quitar"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={onClearAll}
            style={{
              margin: '6px 12px 0',
              background: 'transparent',
              border: 'none',
              padding: '6px 0',
              fontFamily: 'Inter, system-ui',
              fontSize: 13,
              color: 'var(--muted)',
              cursor: 'pointer',
            }}
          >
            Limpiar recientes
          </button>
        </>
      )}

      <SectionTitle>Sugerido</SectionTitle>
      <SuggestedRow emoji="📅" label="Próximo evento" onClick={() => onJumpSection('events')} />
      <SuggestedRow
        emoji="💬"
        label="Discusiones activas"
        onClick={() => onJumpSection('threads')}
        hairline
      />
      <SuggestedRow
        emoji="📚"
        label="Documentos nuevos"
        onClick={() => onJumpSection('library')}
        hairline
      />
    </div>
  )
}

function SuggestedRow({
  emoji,
  label,
  hairline,
  onClick,
}: {
  emoji: string
  label: string
  hairline?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: 12,
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        borderTop: hairline ? '0.5px solid var(--border)' : 'none',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, width: 24, textAlign: 'center' }}>{emoji}</span>
      <span style={{ fontFamily: 'Inter, system-ui', fontSize: 14, color: 'var(--text)' }}>
        {label}
      </span>
    </button>
  )
}

// ─── Results ──────────────────────────────────────────────────────────────

export function SearchResults({
  data,
  onPick,
}: {
  data: SearchResponse
  onPick: (r: SearchResult) => void
}) {
  const groups: { key: keyof SearchResponse; title: string }[] = [
    { key: 'events', title: 'Eventos' },
    { key: 'threads', title: 'Discusiones' },
    { key: 'people', title: 'Personas' },
    { key: 'docs', title: 'Documentos' },
  ]
  const totalCount = groups.reduce((acc, g) => acc + (data[g.key]?.length ?? 0), 0)
  if (totalCount === 0) return null

  return (
    <div>
      {groups.map((g) => {
        const items = data[g.key] ?? []
        if (items.length === 0) return null
        return (
          <div key={g.key}>
            <SectionTitle count={items.length}>{g.title}</SectionTitle>
            {items.slice(0, 5).map((r, i) => (
              <button
                key={r.id}
                onClick={() => onPick(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: 12,
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <ResultIcon r={r} />
                <ResultBody r={r} />
              </button>
            ))}
            {items.length > 5 && (
              <button
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  fontFamily: 'Inter, system-ui',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  borderTop: '0.5px solid var(--border)',
                }}
              >
                Ver todos los resultados en {g.title}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ResultIcon({ r }: { r: SearchResult }) {
  if (r.type === 'event') {
    return (
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: 'var(--accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {r.emoji}
      </span>
    )
  }
  if (r.type === 'thread') {
    return (
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: 'var(--soft)',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }
  if (r.type === 'person') {
    return (
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: r.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui',
          fontWeight: 700,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {r.initials}
      </span>
    )
  }
  // doc — reuse FileIcon from library/components
  return (
    <span
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'var(--soft)',
        color: 'var(--muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 700 }}>
        {r.docType.toUpperCase().slice(0, 3)}
      </span>
    </span>
  )
}

function ResultBody({ r }: { r: SearchResult }) {
  let title = ''
  let meta = ''
  if (r.type === 'event') {
    title = r.title
    meta = r.date.toLocaleString('es-AR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  } else if (r.type === 'thread') {
    title = r.title
    meta = `${r.replies} ${r.replies === 1 ? 'respuesta' : 'respuestas'}`
  } else if (r.type === 'person') {
    title = r.name
  } else {
    title = r.title
    meta = r.categoryTitle
  }
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </div>
      {meta && (
        <div
          style={{
            fontFamily: 'Inter, system-ui',
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 2,
          }}
        >
          {meta}
        </div>
      )}
    </div>
  )
}

// ─── No results ───────────────────────────────────────────────────────────

export function NoResults({ query }: { query: string }) {
  return (
    <div
      style={{
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 48, lineHeight: 1 }}>🔎</div>
      <p
        style={{
          margin: 0,
          textAlign: 'center',
          fontFamily: 'Inter, system-ui',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text)',
        }}
      >
        Sin resultados
      </p>
      <p
        style={{
          margin: 0,
          textAlign: 'center',
          fontFamily: 'Inter, system-ui',
          fontSize: 13,
          color: 'var(--muted)',
        }}
      >
        para “{query}”
      </p>
    </div>
  )
}
