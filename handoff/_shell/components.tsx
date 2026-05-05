/**
 * SHELL components — reference (do not copy verbatim).
 * Source-of-truth for layout, behavior, sizing.
 * Translate inline styles to Tailwind in your implementation.
 */

import * as React from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────

export type Community = {
  id: string
  name: string
  sub: string
  members: number
  color: string // hex used for the avatar bg
}

export type Section = { id: string; label: string }

// ─── Status bar ────────────────────────────────────────────────────────────
// Cosmetic only — render only in preview/storybook, never in production.

export function StatusBar() {
  return (
    <div
      style={{
        height: 47,
        padding: '0 28px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingBottom: 8,
        color: 'var(--text)',
        fontFamily: 'Inter, -apple-system, system-ui',
        fontWeight: 600,
        fontSize: 15,
      }}
    >
      <span style={{ letterSpacing: -0.2 }}>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Signal · WiFi · Battery — keep as inline SVGs or replace with lucide */}
      </div>
    </div>
  )
}

// ─── TopBar ────────────────────────────────────────────────────────────────

export function TopBar({
  community,
  onOpenSwitcher,
  onOpenSearch,
  dropdownOpen,
}: {
  community: Community
  onOpenSwitcher: () => void
  onOpenSearch: () => void
  dropdownOpen: boolean
}) {
  return (
    <div
      style={{
        padding: '6px 12px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        position: 'relative',
        zIndex: 3,
        background: 'var(--bg)',
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      {/* Logo (left, 36×36 surface chip) */}
      <button aria-label="My place" style={squareBtn}>
        {/* <LogoMark size={20} /> */}
      </button>

      {/* Community switcher (center, fills) */}
      <button
        onClick={onOpenSwitcher}
        style={{
          ...resetBtn,
          flex: 1,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: community.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 11,
            fontFamily: 'Inter, system-ui',
          }}
        >
          {community.name[0]}
        </div>
        <span
          style={{
            fontFamily: 'Inter, system-ui',
            fontWeight: 600,
            fontSize: 15,
            color: 'var(--text)',
            letterSpacing: -0.2,
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {community.name}
        </span>
        <div
          style={{
            transition: 'transform 0.2s',
            transform: dropdownOpen ? 'rotate(180deg)' : 'none',
            display: 'flex',
          }}
        >
          {/* <ChevronDown size={14} /> */}
        </div>
      </button>

      {/* Search (right, 36×36 surface chip) */}
      <button onClick={onOpenSearch} aria-label="Buscar" style={squareBtn}>
        {/* <Search size={18} /> */}
      </button>
    </div>
  )
}

// ─── Dots ──────────────────────────────────────────────────────────────────

export function Dots({
  sections,
  current,
  onGo,
}: {
  sections: Section[]
  current: number
  onGo: (i: number) => void
}) {
  return (
    <div
      style={{
        padding: '10px 0 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: 'var(--bg)',
        position: 'relative',
        zIndex: 2,
      }}
    >
      {sections.map((s, i) => {
        const active = i === current
        return (
          <button
            key={s.id}
            onClick={() => onGo(i)}
            aria-label={s.label}
            style={{
              ...resetBtn,
              padding: '6px 3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: active ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: active ? 'var(--text)' : 'var(--dot)',
                transition: 'width 0.24s cubic-bezier(.3,.7,.4,1), background 0.2s',
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

// ─── Community dropdown ───────────────────────────────────────────────────

export function CommunityDropdown({
  open,
  communities,
  current,
  onSelect,
  onClose,
}: {
  open: boolean
  communities: Community[]
  current: Community
  onSelect: (c: Community) => void
  onClose: () => void
}) {
  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 40,
          background: open ? 'rgba(20,18,15,0.32)' : 'transparent',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'background 0.22s',
        }}
      />
      {/* panel */}
      <div
        style={{
          position: 'absolute',
          top: 94,
          left: 12,
          right: 12,
          zIndex: 41,
          background: 'var(--surface)',
          borderRadius: 18,
          border: '0.5px solid var(--border)',
          boxShadow: '0 24px 48px rgba(20,18,15,0.18), 0 2px 6px rgba(20,18,15,0.06)',
          overflow: 'hidden',
          transform: open ? 'translateY(0)' : 'translateY(-12px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 0.22s cubic-bezier(.3,.7,.4,1), opacity 0.22s',
        }}
      >
        <div
          style={{
            padding: '14px 16px 8px',
            fontFamily: 'Inter, system-ui',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          Tus comunidades
        </div>

        {communities.map((c, i) => {
          const active = c.id === current.id
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              style={{
                ...resetBtn,
                width: '100%',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderTop: i === 0 ? 'none' : '0.5px solid var(--border)',
                background: active ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: c.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  fontFamily: 'Inter, system-ui',
                  flexShrink: 0,
                }}
              >
                {c.name[0]}
              </div>
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'Inter, system-ui',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text)',
                    letterSpacing: -0.2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{
                    fontFamily: 'Inter, system-ui',
                    fontSize: 12,
                    color: 'var(--muted)',
                    marginTop: 2,
                  }}
                >
                  {c.sub} · {c.members} miembros
                </div>
              </div>
              {active && (
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* <Check size={12} color="#fff" /> */}
                </div>
              )}
            </button>
          )
        })}

        {/* Discover community */}
        <button
          onClick={onClose}
          style={{
            ...resetBtn,
            width: '100%',
            padding: '12px 14px',
            borderTop: '0.5px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--muted)',
            fontFamily: 'Inter, system-ui',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'var(--bg)',
              border: '1px dashed var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            +
          </div>
          Descubrir comunidades
        </button>
      </div>
    </>
  )
}

// ─── Style primitives (translate to Tailwind) ─────────────────────────────

const resetBtn: React.CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  color: 'inherit',
  font: 'inherit',
}

const squareBtn: React.CSSProperties = {
  ...resetBtn,
  width: 36,
  height: 36,
  borderRadius: 12,
  background: 'var(--surface)',
  border: '0.5px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
