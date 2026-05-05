/**
 * LIBRARY CATEGORY components — reference. Translate inline → Tailwind.
 *
 * Reuses RecentDocRow + FileIcon from library/components.tsx.
 */

import * as React from 'react'
import type { LibraryDoc, DocType } from '../library/components'

type FilterValue = DocType | 'all'

// ─── Header bar ───────────────────────────────────────────────────────────

export function CategoryHeaderBar({
  onBack,
  onSearch,
}: {
  onBack: () => void
  onSearch?: () => void
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
        justifyContent: 'space-between',
        background: 'var(--bg)',
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
        </span>
        <span
          style={{
            fontFamily: 'Inter, system-ui',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text)',
          }}
        >
          Biblioteca
        </span>
      </button>
      {onSearch && (
        <button
          onClick={onSearch}
          aria-label="Buscar"
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
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M20 20l-3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Title block ──────────────────────────────────────────────────────────

export function CategoryTitle({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ padding: '18px 12px 0' }}>
      <h1
        style={{
          fontFamily: 'var(--title-font)',
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          margin: 0,
          color: 'var(--text)',
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: '4px 0 0',
          fontFamily: 'Inter, system-ui',
          fontSize: 13,
          color: 'var(--muted)',
        }}
      >
        {count} {count === 1 ? 'documento' : 'documentos'}
      </p>
    </div>
  )
}

// ─── Type filter bar ──────────────────────────────────────────────────────

const TYPE_LABEL: Record<FilterValue, string> = {
  all: 'Todos',
  pdf: 'PDF',
  link: 'Links',
  image: 'Imágenes',
  doc: 'Docs',
  sheet: 'Hojas',
}

export function TypeFilterBar({
  available,
  value,
  onChange,
}: {
  available: DocType[]
  value: FilterValue
  onChange: (v: FilterValue) => void
}) {
  // Always show "all", then any available types in canonical order
  const order: FilterValue[] = ['all', 'pdf', 'link', 'image', 'doc', 'sheet']
  const items = order.filter((v) => v === 'all' || available.includes(v as DocType))

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
        const active = it === value
        return (
          <button
            key={it}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it)}
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
            {TYPE_LABEL[it]}
          </button>
        )
      })}
    </div>
  )
}

// ─── Doc list (reuses library row) ────────────────────────────────────────

import { RecentDocRow } from '../library/components'

export function DocList({ docs, onOpen }: { docs: LibraryDoc[]; onOpen: (d: LibraryDoc) => void }) {
  return (
    <div
      style={{
        margin: '4px 12px 24px',
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      {docs.map((d, i) => (
        // For Tailwind translation, swap RecentDocRow for an onClick row
        // — here we leave hrefFor as a stub that triggers onOpen via wrapper.
        <button
          key={d.id}
          onClick={() => onOpen(d)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
          }}
        >
          <RecentDocRow doc={d} href="#" hairline={false} />
        </button>
      ))}
    </div>
  )
}

// ─── Empty results ────────────────────────────────────────────────────────

export function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div
      style={{
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 48, lineHeight: 1 }}>🔎</div>
      <p
        style={{
          margin: 0,
          fontFamily: 'Inter, system-ui',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--text)',
        }}
      >
        Sin resultados
      </p>
      <p style={{ margin: 0, fontFamily: 'Inter, system-ui', fontSize: 13, color: 'var(--muted)' }}>
        Probá otro filtro
      </p>
      <button
        onClick={onClear}
        style={{
          marginTop: 6,
          height: 36,
          padding: '0 16px',
          borderRadius: 999,
          background: 'var(--soft)',
          color: 'var(--text)',
          border: 'none',
          fontFamily: 'Inter, system-ui',
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Limpiar filtros
      </button>
    </div>
  )
}
