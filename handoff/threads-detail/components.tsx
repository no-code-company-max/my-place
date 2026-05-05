/**
 * THREAD DETAIL components — reference. Translate inline → Tailwind.
 */

import * as React from 'react'

type Author = { initials: string; color: string; name: string }
type Reader = { id: string; initials: string; color: string }

// ─── Header bar ───────────────────────────────────────────────────────────

export function ThreadHeaderBar({ onBack }: { onBack: () => void }) {
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
        justifyContent: 'space-between',
        background: 'var(--bg)',
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      <button
        onClick={onBack}
        aria-label="Volver"
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
      <button
        aria-label="Más opciones"
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
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}

// ─── Body ─────────────────────────────────────────────────────────────────

export function ThreadBody({
  author,
  createdAt,
  title,
  body,
}: {
  author: Author
  createdAt: Date
  title: string
  body: string
}) {
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <AuthorRow author={author} createdAt={createdAt} avatarSize={28} />
      <h1
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          textWrap: 'balance' as any,
          margin: '14px 0',
          color: 'var(--text)',
        }}
      >
        {title}
      </h1>
      <div
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 16,
          lineHeight: 1.55,
          color: 'var(--text)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {body}
      </div>
    </div>
  )
}

// ─── Action row ───────────────────────────────────────────────────────────

export function ActionRow({
  liked,
  likeCount,
  replyCount,
  onToggleLike,
  onJumpToReplies,
}: {
  liked: boolean
  likeCount: number
  replyCount: number
  onToggleLike: () => void
  onJumpToReplies: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        padding: '16px 16px 0',
        fontFamily: 'Inter, system-ui',
        fontSize: 14,
        color: 'var(--muted)',
      }}
    >
      <button onClick={onToggleLike} style={btn(liked ? 'var(--accent)' : 'var(--muted)')}>
        <Heart filled={liked} />
        <span>{likeCount}</span>
      </button>
      <button onClick={onJumpToReplies} style={btn('var(--muted)')}>
        <Bubble />
        <span>{replyCount}</span>
      </button>
      <button style={btn('var(--muted)')} aria-label="Compartir">
        <Share />
      </button>
    </div>
  )
}

function btn(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: 'none',
    padding: '6px 0',
    color,
    cursor: 'pointer',
  }
}

// ─── Readers ──────────────────────────────────────────────────────────────

export function Readers({ readers, total }: { readers: Reader[]; total: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 16px 18px',
      }}
    >
      <div style={{ display: 'flex' }}>
        {readers.slice(0, 5).map((r, i) => (
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
      <span style={{ fontFamily: 'Inter, system-ui', fontSize: 13, color: 'var(--muted)' }}>
        {total} leyeron
      </span>
    </div>
  )
}

// ─── Replies section ──────────────────────────────────────────────────────

export function RepliesHeader({ count }: { count: number }) {
  return (
    <div
      style={{
        padding: '14px 16px 6px',
        borderTop: '0.5px solid var(--border)',
        fontFamily: 'Inter, system-ui',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'var(--muted)',
      }}
    >
      {count} respuestas
    </div>
  )
}

export function Reply({
  author,
  createdAt,
  body,
  quoteOf,
  liked,
  onLike,
  onReply,
}: {
  author: Author
  createdAt: Date
  body: string
  quoteOf?: { author: string; text: string }
  liked: boolean
  onLike: () => void
  onReply: () => void
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderTop: '0.5px solid var(--border)',
      }}
    >
      <AuthorRow author={author} createdAt={createdAt} avatarSize={28} />
      {quoteOf && <QuoteBlock author={quoteOf.author} text={quoteOf.text} />}
      <p
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 14.5,
          lineHeight: 1.55,
          color: 'var(--text)',
          margin: '8px 0 0',
          whiteSpace: 'pre-wrap',
        }}
      >
        {body}
      </p>
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          marginTop: 10,
          fontFamily: 'Inter, system-ui',
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        <button onClick={onLike} style={btn(liked ? 'var(--accent)' : 'var(--muted)')}>
          <Heart filled={liked} size={14} />
        </button>
        <button onClick={onReply} style={btn('var(--muted)')}>
          responder
        </button>
      </div>
    </div>
  )
}

export function QuoteBlock({ author, text }: { author: string; text: string }) {
  return (
    <div
      style={{
        marginTop: 8,
        paddingLeft: 10,
        borderLeft: '2px solid var(--accent)',
      }}
    >
      <p
        style={{
          fontFamily: 'Inter, system-ui',
          fontStyle: 'italic',
          fontSize: 13.5,
          color: 'var(--muted)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        “{text}”
      </p>
      <span
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 11.5,
          fontWeight: 500,
          color: 'var(--muted)',
        }}
      >
        — {author}
      </span>
    </div>
  )
}

// ─── Composer ─────────────────────────────────────────────────────────────

export function Composer({
  selfInitials,
  selfColor,
  quoting,
  onClearQuote,
  onSend,
}: {
  selfInitials: string
  selfColor: string
  quoting?: { author: string; text: string }
  onClearQuote: () => void
  onSend: (body: string) => void
}) {
  const [v, setV] = React.useState('')
  const ref = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 4 * 22) + 'px'
  }, [v])

  const submit = () => {
    if (!v.trim()) return
    onSend(v.trim())
    setV('')
  }

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--surface)',
        borderTop: '0.5px solid var(--border)',
        padding: '8px 12px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
      }}
    >
      {quoting && (
        <div
          style={{
            margin: '4px 0 8px',
            paddingLeft: 10,
            borderLeft: '2px solid var(--accent)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: 'Inter, system-ui',
                fontSize: 12.5,
                color: 'var(--muted)',
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Citando a {quoting.author}: “{quoting.text}”
            </p>
          </div>
          <button
            onClick={onClearQuote}
            aria-label="Quitar cita"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 0,
              lineHeight: 1,
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: selfColor,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, system-ui',
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {selfInitials}
        </div>
        <textarea
          ref={ref}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
          }}
          placeholder="Escribí una respuesta…"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'Inter, system-ui',
            fontSize: 15,
            lineHeight: 1.4,
            color: 'var(--text)',
            padding: '8px 0',
          }}
        />
        <button
          onClick={submit}
          disabled={!v.trim()}
          aria-label="Enviar"
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            cursor: v.trim() ? 'pointer' : 'default',
            opacity: v.trim() ? 1 : 0.4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12l14-7-7 14-2-5-5-2z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

function AuthorRow({
  author,
  createdAt,
  avatarSize = 24,
}: {
  author: Author
  createdAt: Date
  avatarSize?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: 999,
          background: author.color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, system-ui',
          fontWeight: 700,
          fontSize: avatarSize <= 24 ? 11 : 12,
        }}
      >
        {author.initials}
      </div>
      <span
        style={{
          fontFamily: 'Inter, system-ui',
          fontSize: 14,
          fontWeight: 600,
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

function Heart({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}>
      <path
        d="M12 21s-7-4.5-9.5-9C1 9 3 5 6.5 5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 5 23 9 21.5 12c-2.5 4.5-9.5 9-9.5 9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Bubble() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Share() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M16 6l-4-4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 2v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

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
