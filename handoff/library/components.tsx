/**
 * LIBRARY components — reference. Translate inline → Tailwind.
 */

import * as React from 'react'

export type LibraryCategory = {
  id: string
  emoji: string
  title: string
  docCount: number
}
export type DocType = 'pdf' | 'image' | 'link' | 'doc' | 'sheet'
export type LibraryDoc = {
  id: string
  title: string
  type: DocType
  url: string
  categoryTitle: string
  uploadedAt: Date
}

// ─── Section header ───────────────────────────────────────────────────────

export function LibraryHeader() {
  return (
    <div style={{ padding: '24px 12px 18px' }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
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
          📚
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
          Biblioteca
        </h1>
      </div>
      <p
        style={{
          margin: '6px 0 0',
          fontFamily: 'Inter, system-ui',
          fontSize: 14,
          color: 'var(--muted)',
        }}
      >
        Organizado por categoría
      </p>
    </div>
  )
}

// ─── Category grid ────────────────────────────────────────────────────────

export function CategoryGrid({
  categories,
  hrefFor,
}: {
  categories: LibraryCategory[]
  hrefFor: (c: LibraryCategory) => string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        padding: '0 12px',
      }}
    >
      {categories.map((c) => (
        <CategoryCard key={c.id} category={c} href={hrefFor(c)} />
      ))}
    </div>
  )
}

export function CategoryCard({ category, href }: { category: LibraryCategory; href: string }) {
  return (
    <a
      href={href}
      style={{
        aspectRatio: '1 / 1',
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 18,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span style={{ fontSize: 36, lineHeight: 1 }}>{category.emoji}</span>
      <div>
        <div
          style={{
            fontFamily: 'var(--title-font)',
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--text)',
          }}
        >
          {category.title}
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: 'Inter, system-ui',
            fontSize: 12.5,
            color: 'var(--muted)',
          }}
        >
          {category.docCount} {category.docCount === 1 ? 'doc' : 'docs'}
        </div>
      </div>
    </a>
  )
}

// ─── Recents ──────────────────────────────────────────────────────────────

export function Recents({
  docs,
  hrefFor,
}: {
  docs: LibraryDoc[]
  hrefFor: (d: LibraryDoc) => string
}) {
  return (
    <section style={{ padding: '24px 12px 24px' }}>
      <h2
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          margin: '0 0 8px',
          color: 'var(--text)',
        }}
      >
        Recientes
      </h2>
      <div
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        {docs.map((d, i) => (
          <RecentDocRow key={d.id} doc={d} href={hrefFor(d)} hairline={i > 0} />
        ))}
      </div>
    </section>
  )
}

export function RecentDocRow({
  doc,
  href,
  hairline,
}: {
  doc: LibraryDoc
  href: string
  hairline: boolean
}) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: 12,
        textDecoration: 'none',
        color: 'inherit',
        borderTop: hairline ? '0.5px solid var(--border)' : 'none',
      }}
    >
      <FileIcon type={doc.type} />
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
          {doc.title}
        </div>
        <div
          style={{
            fontFamily: 'Inter, system-ui',
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 2,
          }}
        >
          {doc.categoryTitle} · {formatRelative(doc.uploadedAt)}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--muted)' }}>
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  )
}

// ─── File icon ────────────────────────────────────────────────────────────

export function FileIcon({ type }: { type: DocType }) {
  const cfg = ICON_CFG[type]
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: cfg.bg,
        color: cfg.fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {cfg.glyph}
    </div>
  )
}

const ICON_CFG: Record<DocType, { bg: string; fg: string; glyph: React.ReactNode }> = {
  pdf: {
    bg: 'oklch(0.95 0.04 25)',
    fg: 'oklch(0.55 0.18 25)',
    glyph: (
      <span style={{ fontFamily: 'Inter, system-ui', fontSize: 9, fontWeight: 700 }}>PDF</span>
    ),
  },
  image: {
    bg: 'oklch(0.95 0.04 240)',
    fg: 'oklch(0.5 0.15 240)',
    glyph: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="11" r="1.5" fill="currentColor" />
        <path
          d="M21 17l-5-5-9 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  link: {
    bg: 'oklch(0.95 0.04 150)',
    fg: 'oklch(0.45 0.13 150)',
    glyph: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  doc: {
    bg: 'oklch(0.95 0.04 75)',
    fg: 'oklch(0.5 0.13 75)',
    glyph: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  sheet: {
    bg: 'oklch(0.95 0.04 190)',
    fg: 'oklch(0.45 0.12 190)',
    glyph: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 10h18M3 16h18M9 4v16M15 4v16" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
}

// ─── Empty ────────────────────────────────────────────────────────────────

export function EmptyLibrary({ onUpload }: { onUpload?: () => void }) {
  return (
    <div
      style={{
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ fontSize: 64, lineHeight: 1 }}>📭</div>
      <p
        style={{
          margin: 0,
          textAlign: 'center',
          fontFamily: 'Inter, system-ui',
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--text)',
        }}
      >
        Tu comunidad todavía no agregó recursos.
      </p>
      <button
        onClick={onUpload}
        style={{
          height: 40,
          padding: '0 18px',
          borderRadius: 999,
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          fontFamily: 'Inter, system-ui',
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Subir el primero
      </button>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime()
  const h = Math.round(diff / 36e5)
  if (h < 1) return 'recién'
  if (h < 24) return `hace ${h} h`
  const days = Math.round(h / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} d`
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}
