/**
 * Home — Reference components from the prototype
 *
 * ⚠️  These are REFERENCE components from the design prototype.
 * They use inline styles with CSS variables. When porting to the
 * production codebase, translate to Tailwind classes (keeping the
 * CSS variables, e.g. `bg-surface`, `text-muted`) — but keep the
 * structure, hierarchy, and decisions intact.
 *
 * The default Event variant is "postit" and the default Library
 * variant is "stack". Other variants are included in case product
 * wants to A/B test.
 */

// ─── Types ─────────────────────────────────────────────────────

export type Community = {
  id: string
  name: string
  emoji: string
  members: number
}

export type Thread = {
  id: string
  title: string
  preview: string
  author: string
  initials: string
  time: string
  replies?: number
  likes?: number
  tag?: string
}

export type Event = {
  id: string
  title: string
  date: string // e.g. "Mar 14 Nov"
  time: string // e.g. "19:00"
  place: string
  emoji?: string
  attending: number
}

export type LibraryDoc = {
  id: string
  title: string
  kind: 'PDF' | 'Nota' | 'Link' | 'Carpeta' | 'Figma' | 'Mapa' | 'Hoja' | 'Video'
}

export type HomeProps = {
  community: Community
  latestThread?: Thread
  nextEvent?: Event
  latestDocs: LibraryDoc[]
  totalDocs: number
  members: { initials: string }[]
  density?: 'compact' | 'regular' | 'comfy'
  eventVariant?: 'postit' | 'wall' | 'minimal' | 'countdown'
  libraryVariant?: 'stack' | 'list' | 'tiles'
  onOpenThread?: (t: Thread) => void
  onOpenEvent?: (e: Event) => void
}

// ─── Shared primitives (extract to components/ui/) ────────────

const MEMBER_COLORS = [
  '#c0825b',
  '#7a8c5a',
  '#4f6b85',
  '#8b6aa3',
  '#b08a3e',
  '#8a5a2b',
  '#9a6b4e',
  '#5e7d6f',
]

function Avatar({
  initials,
  color = '#8a7f6b',
  size = 32,
}: {
  initials: string
  color?: string
  size?: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'var(--body-font)',
        fontWeight: 600,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

function BentoCard({
  children,
  onClick,
  style,
}: {
  children: React.ReactNode
  onClick?: () => void
  style?: React.CSSProperties
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-card)',
        border: '0.5px solid var(--border)',
        padding: 'var(--pad)',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function BentoHead({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--body-font)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'var(--muted)',
      }}
    >
      {label}
    </div>
  )
}

// ─── Home ──────────────────────────────────────────────────────

export function Home({
  community,
  latestThread,
  nextEvent,
  latestDocs,
  totalDocs,
  members,
  density = 'regular',
  eventVariant = 'postit',
  libraryVariant = 'stack',
  onOpenThread,
  onOpenEvent,
}: HomeProps) {
  const memberInitials = members.slice(0, 8).map((m) => m.initials)
  const gap = density === 'compact' ? 8 : 10

  return (
    <div style={{ padding: '4px 12px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Community hero */}
      <div style={{ padding: '14px 4px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {community.emoji}
        </div>
        <div
          style={{
            fontFamily: 'var(--title-font)',
            fontSize: 26,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: -0.6,
          }}
        >
          {community.name}
        </div>
      </div>

      {/* Bento grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        {/* Latest thread (full-width) */}
        {latestThread && (
          <BentoCard
            style={{ gridColumn: '1 / -1' }}
            onClick={onOpenThread ? () => onOpenThread(latestThread) : undefined}
          >
            <BentoHead label="Conversacion" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                marginBottom: 10,
              }}
            >
              <Avatar initials={latestThread.initials} size={26} />
              <span
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                }}
              >
                {latestThread.author}
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--title-font)',
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--text)',
                letterSpacing: -0.3,
                lineHeight: 1.3,
              }}
            >
              {latestThread.title}
            </div>
            {latestThread.preview && (
              <div
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 13,
                  color: 'var(--muted)',
                  lineHeight: 1.45,
                  marginTop: 6,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {latestThread.preview}
              </div>
            )}
          </BentoCard>
        )}

        {/* Next event (1 col) */}
        {nextEvent && (
          <EventBento
            event={nextEvent}
            variant={eventVariant}
            onClick={onOpenEvent ? () => onOpenEvent(nextEvent) : undefined}
          />
        )}

        {/* Library (1 col) */}
        <LibraryBento docs={latestDocs} total={totalDocs} variant={libraryVariant} />

        {/* Members (full-width) */}
        <BentoCard style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <UsersIcon size={24} color="var(--muted)" />
              <span
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                Miembros
              </span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              {memberInitials.slice(0, 5).map((initials, i) => (
                <div
                  key={i}
                  style={{
                    marginLeft: i === 0 ? 0 : -10,
                    border: '2px solid var(--surface)',
                    borderRadius: 999,
                  }}
                >
                  <Avatar
                    initials={initials}
                    size={32}
                    color={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                  />
                </div>
              ))}
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  )
}

// ─── Event variants ────────────────────────────────────────────

function parseDateParts(dateStr: string) {
  const parts = (dateStr || '').split(' ')
  const day = parts.find((p) => /^\d+$/.test(p)) || ''
  const dayName = parts.find((p) => /^[A-Za-zÁÉÍÓÚáéíóú]{3}$/.test(p)) || parts[0] || ''
  const month = parts.filter((p) => !/^\d+$/.test(p) && p !== dayName).join(' ') || ''
  return { day, dayName, month }
}

function EventBento({
  event,
  variant,
  onClick,
}: {
  event: Event
  variant: HomeProps['eventVariant']
  onClick?: () => void
}) {
  if (variant === 'wall') return <EventBentoWall event={event} onClick={onClick} />
  if (variant === 'minimal') return <EventBentoMinimal event={event} onClick={onClick} />
  if (variant === 'countdown') return <EventBentoCountdown event={event} onClick={onClick} />
  return <EventBentoPostIt event={event} onClick={onClick} />
}

// Variant A — Post-it (default)
function EventBentoPostIt({ event, onClick }: { event: Event; onClick?: () => void }) {
  const { day, month } = parseDateParts(event.date)
  return (
    <div style={{ position: 'relative', padding: '8px 0 0' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          transform: 'translateX(-50%) rotate(-2deg)',
          width: 48,
          height: 14,
          background: 'rgba(200, 180, 140, 0.55)',
          border: '0.5px solid rgba(120, 90, 40, 0.15)',
          zIndex: 2,
        }}
      />
      <div
        onClick={onClick}
        style={{
          background: '#f2d88a',
          borderRadius: 3,
          padding: 'var(--pad)',
          transform: 'rotate(-1.2deg)',
          boxShadow: '0 2px 6px rgba(60,40,10,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)',
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--body-font)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: '#6b4a10',
          }}
        >
          Evento
        </div>
        <div
          style={{
            fontFamily: 'var(--title-font)',
            fontSize: 32,
            fontWeight: 700,
            color: '#3a2a0a',
            letterSpacing: -1,
            lineHeight: 1,
            marginTop: 6,
          }}
        >
          {day}
        </div>
        <div
          style={{
            fontFamily: 'var(--body-font)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: '#6b4a10',
            marginTop: 2,
          }}
        >
          {month} · {event.time}
        </div>
        <div
          style={{
            fontFamily: 'var(--title-font)',
            fontSize: 13,
            fontWeight: 600,
            color: '#3a2a0a',
            lineHeight: 1.25,
            marginTop: 10,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {event.title}
        </div>
      </div>
    </div>
  )
}

// Variant B — Wall calendar
function EventBentoWall({ event, onClick }: { event: Event; onClick?: () => void }) {
  const { day, month } = parseDateParts(event.date)
  const dayNum = parseInt(day, 10) || 1
  const days = [-2, -1, 0, 1, 2].map((d) => dayNum + d).filter((n) => n > 0 && n < 32)
  return (
    <BentoCard onClick={onClick} style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          height: 8,
          background: 'var(--accent)',
          clipPath:
            'polygon(0 0, 100% 0, 100% 60%, 95% 100%, 90% 60%, 85% 100%, 80% 60%, 75% 100%, 70% 60%, 65% 100%, 60% 60%, 55% 100%, 50% 60%, 45% 100%, 40% 60%, 35% 100%, 30% 60%, 25% 100%, 20% 60%, 15% 100%, 10% 60%, 5% 100%, 0 60%)',
        }}
      />
      <div style={{ padding: 'var(--pad)' }}>
        <div
          style={{
            fontFamily: 'var(--body-font)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--muted)',
            textAlign: 'center',
          }}
        >
          {month}
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, marginTop: 8 }}
        >
          {days.map((n) => {
            const active = n === dayNum
            return (
              <div
                key={n}
                style={{
                  aspectRatio: '1 / 1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--title-font)',
                  fontSize: active ? 14 : 11,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#fff' : 'var(--muted)',
                  background: active ? 'var(--accent)' : 'transparent',
                  borderRadius: active ? 6 : 0,
                }}
              >
                {n}
              </div>
            )
          })}
        </div>
        <div
          style={{
            fontFamily: 'var(--title-font)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            lineHeight: 1.25,
            marginTop: 10,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {event.title}
        </div>
        <div
          style={{
            fontFamily: 'var(--body-font)',
            fontSize: 11,
            color: 'var(--muted)',
            marginTop: 4,
          }}
        >
          {event.time}
        </div>
      </div>
    </BentoCard>
  )
}

// Variant C — Minimal
function EventBentoMinimal({ event, onClick }: { event: Event; onClick?: () => void }) {
  const { day, month } = parseDateParts(event.date)
  return (
    <BentoCard onClick={onClick}>
      <div
        style={{
          fontFamily: 'var(--mono-font)',
          fontSize: 11,
          letterSpacing: 0.5,
          color: 'var(--accent)',
          fontWeight: 600,
        }}
      >
        {String(day).padStart(2, '0')} · {(month || '').toUpperCase()} · {event.time}
      </div>
      <div
        style={{
          height: 1,
          background: 'var(--accent)',
          marginTop: 8,
          marginBottom: 10,
          width: 24,
        }}
      />
      <div
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text)',
          letterSpacing: -0.2,
          lineHeight: 1.25,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {event.title}
      </div>
      <div
        style={{
          fontFamily: 'var(--body-font)',
          fontSize: 11,
          color: 'var(--muted)',
          marginTop: 8,
          letterSpacing: 0.2,
        }}
      >
        {event.attending} confirmados
      </div>
    </BentoCard>
  )
}

// Variant D — Countdown
function EventBentoCountdown({ event, onClick }: { event: Event; onClick?: () => void }) {
  // ⚠️ In production, compute real days-until from event date
  const hash = (event.title || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const days = (hash % 12) + 2
  return (
    <BentoCard onClick={onClick} style={{ background: 'var(--accent)', border: 'none' }}>
      <div
        style={{
          fontFamily: 'var(--body-font)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.75)',
        }}
      >
        Faltan
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span
          style={{
            fontFamily: 'var(--title-font)',
            fontSize: 40,
            fontWeight: 700,
            color: '#fff',
            letterSpacing: -1.5,
            lineHeight: 1,
          }}
        >
          {days}
        </span>
        <span
          style={{
            fontFamily: 'var(--body-font)',
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
          }}
        >
          días
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 14,
          fontWeight: 600,
          color: '#fff',
          lineHeight: 1.25,
          marginTop: 12,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {event.title}
      </div>
      <div
        style={{
          fontFamily: 'var(--body-font)',
          fontSize: 12,
          color: 'rgba(255,255,255,0.75)',
          marginTop: 4,
        }}
      >
        {event.date} · {event.time}
      </div>
    </BentoCard>
  )
}

// ─── Library variants ──────────────────────────────────────────

function LibraryBento({
  docs,
  total,
  variant,
}: {
  docs: LibraryDoc[]
  total: number
  variant: HomeProps['libraryVariant']
}) {
  if (variant === 'list') return <LibraryBentoList docs={docs} />
  if (variant === 'tiles') return <LibraryBentoTiles docs={docs} total={total} />
  return <LibraryBentoStack docs={docs} />
}

// Variant A — list
function LibraryBentoList({ docs }: { docs: LibraryDoc[] }) {
  return (
    <BentoCard>
      <BentoHead label="Biblioteca" />
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: 'var(--soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <DocIcon size={13} color="var(--muted)" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text)',
                  letterSpacing: -0.1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.title}
              </div>
              <div
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 10.5,
                  color: 'var(--muted)',
                  marginTop: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.kind}
              </div>
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  )
}

// Variant B — stack (default)
const LIB_COLORS = ['#d4b896', '#c49f7a', '#b5906b']
function LibraryBentoStack({ docs }: { docs: LibraryDoc[] }) {
  const top = docs[0]
  return (
    <BentoCard>
      <BentoHead label="Biblioteca" />
      <div style={{ position: 'relative', marginTop: 12, flex: 1, minHeight: 92 }}>
        {[2, 1].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              background: LIB_COLORS[i] || 'var(--soft)',
              borderRadius: 8,
              transform: `translate(${i * 4}px, ${i * 3}px) rotate(${i * 2}deg)`,
              transformOrigin: 'bottom left',
              border: '0.5px solid rgba(0,0,0,0.08)',
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#f5ead6',
            borderRadius: 8,
            border: '0.5px solid rgba(0,0,0,0.08)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--body-font)',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: '#8a6a3a',
            }}
          >
            {top?.kind || 'PDF'}
          </div>
          <div
            style={{
              fontFamily: 'var(--title-font)',
              fontSize: 13,
              fontWeight: 600,
              color: '#3a2c16',
              letterSpacing: -0.2,
              lineHeight: 1.25,
              marginTop: 4,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {top?.title || ''}
          </div>
        </div>
      </div>
    </BentoCard>
  )
}

// Variant C — 2×2 mini-tiles
const KIND_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PDF: { bg: '#e9d5bc', fg: '#6b4a22', label: 'PDF' },
  Figma: { bg: '#d4c7e3', fg: '#4a2d6f', label: 'Figma' },
  Video: { bg: '#cfdccf', fg: '#2f4a2f', label: 'Video' },
  Link: { bg: '#c9d8df', fg: '#2e4958', label: 'Link' },
}
function kindStyle(kind: string) {
  const k = (kind || '').split('·')[0].trim()
  return KIND_STYLE[k] || { bg: 'var(--soft)', fg: 'var(--muted)', label: k || 'Doc' }
}
function LibraryBentoTiles({ docs, total }: { docs: LibraryDoc[]; total: number }) {
  const tiles = docs.slice(0, 3)
  return (
    <BentoCard>
      <BentoHead label="Biblioteca" />
      <div
        style={{
          marginTop: 10,
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
        }}
      >
        {tiles.map((r) => {
          const s = kindStyle(r.kind)
          return (
            <div
              key={r.id}
              style={{
                background: s.bg,
                borderRadius: 8,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 54,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: s.fg,
                  opacity: 0.85,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--body-font)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: s.fg,
                  lineHeight: 1.25,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {r.title}
              </div>
            </div>
          )
        })}
        <div
          style={{
            background: 'var(--soft)',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 54,
            fontFamily: 'var(--body-font)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--muted)',
          }}
        >
          +{Math.max(0, total - tiles.length)} más
        </div>
      </div>
    </BentoCard>
  )
}

// ─── Icons (replace with lucide-react or your icon system) ─────

function UsersIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21.5 17.5c0-2-1.6-3.5-4-3.5" />
    </svg>
  )
}

function DocIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  )
}
