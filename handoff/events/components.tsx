/**
 * Events — Reference Components
 *
 * STRUCTURAL GUIDE, NOT LITERAL CODE.
 *
 * These are extracted from the prototype where styles are inline. When
 * implementing, translate the inline styles to Tailwind utility classes
 * (using the tokens from design-tokens.css / tailwind.config.snippet.ts).
 *
 * Reuse primitives from your shared components/ui/ folder where they exist:
 *   - <Avatar />
 *   - <BentoCard />
 *   - <Composer />
 *   - <CommentItem />
 *   - <SectionHead />
 *
 * If those don't exist yet, this slice is a good moment to extract them.
 */

import { ArrowLeft, Calendar, MapPin, Send, Check } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type RSVP = 'going' | 'maybe' | 'no' | null

type Comment = {
  id: string
  author: string
  initials: string
  time: string // already-formatted relative ("hace 2 h")
  body: string
  quoteOf?: string // id of another Comment
}

type EventListItem = {
  id: string
  title: string
  emoji: string
  date: string // "Sáb 27 Abr"
  time: string // "10:00–14:00"
  place: string
  attending: number
}

type EventData = {
  id: string
  title: string
  emoji: string
  description: string
  date: string // "Sáb 27 Abr"
  time: string
  place: string
  host: { id: string; name: string; initials: string }
  attending: number
  myRsvp: RSVP
  comments: Comment[]
}

// ─────────────────────────────────────────────────────────────
// Screen 1 — Events list (bento)
// ─────────────────────────────────────────────────────────────

export function EventsList({
  community,
  events,
  onOpenEvent,
}: {
  community: { id: string; name: string }
  events: EventListItem[]
  onOpenEvent: (e: EventListItem) => void
}) {
  return (
    <div className="px-3 pb-[100px] pt-1">
      {/* SectionHead — reuse the shared one */}
      <SectionHead meta="Eventos" emoji="📅" />

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        {events.map((e, i) => {
          const isHero = i === 0
          return (
            <button
              key={e.id}
              onClick={() => onOpenEvent(e)}
              className={[
                'rounded-[14px] border-[0.5px] border-border bg-surface text-left',
                isHero ? 'col-span-2 p-4' : 'p-3.5',
              ].join(' ')}
            >
              <div
                className={isHero ? 'text-4xl' : 'text-[26px]'}
                style={{ lineHeight: 1, marginBottom: isHero ? 12 : 10 }}
              >
                {e.emoji || '📅'}
              </div>
              <div
                className={[
                  'font-body font-bold uppercase text-accent',
                  isHero ? 'text-xs' : 'text-[11px]',
                ].join(' ')}
                style={{ letterSpacing: 0.6, marginBottom: 4 }}
              >
                {e.date} · {e.time}
              </div>
              <div
                className={[
                  'font-body font-bold leading-[1.2] text-text',
                  isHero ? 'text-xl' : 'text-sm',
                ].join(' ')}
                style={{ letterSpacing: -0.2 }}
              >
                {e.title}
              </div>
              <div
                className={[
                  'mt-1 font-body leading-[1.35] text-muted',
                  isHero ? 'text-[13px]' : 'text-xs',
                ].join(' ')}
              >
                {e.place}
                {isHero && ` · ${e.attending} van`}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Screen 2 — Event detail
// ─────────────────────────────────────────────────────────────

export function EventDetail({
  event,
  onBack,
  onRsvp,
  onSendReply,
}: {
  event: EventData
  onBack: () => void
  onRsvp: (next: RSVP) => void
  onSendReply: (body: string, quoteOf?: string) => void
}) {
  const [rsvp, setRsvp] = React.useState<RSVP>(event.myRsvp)
  const [replyText, setReplyText] = React.useState('')
  const [quoting, setQuoting] = React.useState<Comment | null>(null)

  const goingCount = event.attending + (rsvp === 'going' ? 1 : 0)
  const dateBits = parseEventDateParts(event.date)
  const byId = React.useMemo(
    () => Object.fromEntries(event.comments.map((c) => [c.id, c])),
    [event.comments],
  )

  const handleRsvp = (next: NonNullable<RSVP>) => {
    const value = rsvp === next ? null : next
    setRsvp(value)
    onRsvp(value)
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      {/* Back-only header */}
      <div className="flex items-center gap-2 bg-bg px-3 py-2">
        <button
          onClick={onBack}
          aria-label="Volver"
          className="flex h-9 w-9 items-center justify-center rounded-xl border-[0.5px] border-border bg-surface"
        >
          <ArrowLeft size={16} className="text-text" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-[22px] pb-3 pt-5">
        {/* Tag overline */}
        <div
          className="flex items-center gap-1.5 font-body text-[11px] font-bold uppercase text-accent"
          style={{ letterSpacing: 0.8 }}
        >
          <span className="text-[13px]">{event.emoji}</span>
          <span>Evento</span>
        </div>

        {/* Title */}
        <h1
          className="mt-1.5 font-title text-[28px] font-semibold leading-[1.15] text-text"
          style={{ letterSpacing: -0.7 }}
        >
          {event.title}
        </h1>

        {/* Event card */}
        <div className="mt-[18px] rounded-[14px] border-[0.5px] border-border bg-surface p-3.5">
          {/* Row 1 — Calendar tile + info */}
          <div className="flex items-center gap-3.5">
            {/* Calendar tile */}
            <div className="flex h-[60px] w-14 shrink-0 flex-col items-center justify-center rounded-[10px] bg-soft">
              <div
                className="font-body text-[10px] font-bold text-accent"
                style={{ letterSpacing: 0.6 }}
              >
                {dateBits.month}
              </div>
              <div className="mt-0.5 font-title text-[22px] font-semibold leading-none text-text">
                {dateBits.day}
              </div>
              <div
                className="mt-0.5 font-body text-[9px] font-semibold text-muted"
                style={{ letterSpacing: 0.4 }}
              >
                {dateBits.dow}
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="font-body text-sm font-semibold text-text">{event.time}</div>
              <div className="mt-1 flex items-center gap-1 font-body text-[13px] text-muted">
                <MapPin size={13} />
                <span className="truncate">{event.place}</span>
              </div>
              <div className="mt-1 font-body text-xs text-muted">
                Organiza <span className="font-medium text-text">{event.host.name}</span>
              </div>
            </div>
          </div>

          {/* Row 2 — Attendees */}
          <div className="mt-3.5 flex items-center justify-between border-t-[0.5px] border-border pt-3">
            <div className="flex items-center gap-2">
              <AttendeeAvatars />
              <div className="font-body text-[13px] text-text">
                <span className="font-semibold">{goingCount}</span>{' '}
                <span className="text-muted">van</span>
              </div>
            </div>
          </div>

          {/* Row 3 — RSVP triplet */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'going', label: 'Voy' },
                { id: 'maybe', label: 'Tal vez' },
                { id: 'no', label: 'No puedo' },
              ] as const
            ).map((opt) => {
              const active = rsvp === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => handleRsvp(opt.id)}
                  className={[
                    'flex h-10 items-center justify-center gap-1 rounded-[10px] font-body text-[13px] font-semibold transition-colors',
                    active ? 'bg-text text-bg' : 'bg-soft text-text',
                  ].join(' ')}
                >
                  {active && opt.id === 'going' && <Check size={12} className="text-bg" />}
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div
          className="mt-[18px] font-title text-[17px] leading-[1.55] text-text"
          style={{ letterSpacing: -0.1 }}
        >
          {event.description}
        </div>

        {/* Author footer */}
        <div className="mt-[22px] flex items-center gap-2 font-body text-xs text-muted">
          <Avatar initials={event.host.initials} size={20} />
          <span>
            Organizado por <span className="font-medium text-text">{event.host.name}</span>
          </span>
        </div>

        {/* Comments — same as Threads */}
        <div className="mt-4 border-t-[0.5px] border-border pt-3">
          {event.comments.map((c, i) => {
            const quoted = c.quoteOf ? byId[c.quoteOf] : null
            return (
              <CommentItem
                key={c.id}
                comment={c}
                quoted={quoted}
                isLast={i === event.comments.length - 1}
                onReply={() => setQuoting(c)}
              />
            )
          })}
        </div>
      </div>

      {/* Composer — same as Threads */}
      <Composer
        value={replyText}
        onChange={setReplyText}
        quoting={quoting}
        onCancelQuote={() => setQuoting(null)}
        onSend={() => {
          if (!replyText.trim()) return
          onSendReply(replyText, quoting?.id)
          setReplyText('')
          setQuoting(null)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function AttendeeAvatars() {
  // Stub — wire to real attendees in production
  const initials = ['MT', 'SB', 'CF', 'JH']
  const colors = ['#c0825b', '#7a8c5a', '#4f6b85', '#8b6aa3']
  return (
    <div className="flex">
      {initials.map((x, i) => (
        <div
          key={i}
          className="rounded-full border-2 border-surface"
          style={{ marginLeft: i === 0 ? 0 : -6 }}
        >
          <Avatar initials={x} size={22} color={colors[i]} />
        </div>
      ))}
    </div>
  )
}

/**
 * Parse a Spanish short date "Sáb 27 Abr" into pieces for the calendar tile.
 * Replace this with date-fns formatting in production:
 *
 *   import { format } from 'date-fns';
 *   import { es } from 'date-fns/locale';
 *   format(date, 'EEE', { locale: es })  // 'sáb'
 *   format(date, 'dd', { locale: es })   // '27'
 *   format(date, 'MMM', { locale: es })  // 'abr'
 */
function parseEventDateParts(s: string) {
  const parts = (s || '').split(' ')
  return {
    dow: (parts[0] || '').toUpperCase().replace(/\.$/, ''),
    day: parts[1] || '',
    month: (parts[2] || '').toUpperCase().replace(/\.$/, ''),
  }
}

// ─────────────────────────────────────────────────────────────
// Imports from shared UI (to be implemented or already in repo)
// ─────────────────────────────────────────────────────────────

declare const Avatar: React.FC<{
  initials: string
  size?: number
  color?: string
}>

declare const SectionHead: React.FC<{ meta: string; emoji?: string }>

declare const CommentItem: React.FC<{
  comment: Comment
  quoted: Comment | null
  isLast: boolean
  onReply: () => void
}>

declare const Composer: React.FC<{
  value: string
  onChange: (v: string) => void
  quoting: Comment | null
  onCancelQuote: () => void
  onSend: () => void
}>
