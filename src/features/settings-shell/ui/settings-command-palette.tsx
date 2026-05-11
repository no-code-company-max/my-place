'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SidebarSections, SidebarItem } from '@/shared/ui/sidebar/sidebar.types'

/**
 * Cmd+K command palette para navegación entre sub-pages de `/settings/*`.
 * Hidden en mobile (`md:block`) — el FAB cubre nav mobile, el palette
 * está pensado para power users con teclado en desktop.
 *
 * Listener global a `keydown` Cmd+K (Mac) / Ctrl+K (Windows/Linux). Cuando
 * abre, focus en el input de search; Up/Down navega los items filtrados;
 * Enter activa el item highlighted; Esc cierra (Radix maneja).
 *
 * Limitado a settings (no global): se monta en el `<SettingsShell>` server
 * component, así que solo está activo cuando el user está en `/settings/*`.
 * Si en el futuro queremos comandos globales, mover a un layout más alto.
 *
 * Sin dependencias nuevas (cmdk): Radix Dialog primitive + lógica custom.
 *
 * Ver `docs/plans/2026-05-10-settings-desktop-redesign.md` § "Sesión 7".
 */
type Props = {
  sections: SidebarSections
}

type Option = SidebarItem & { groupLabel: string | undefined }

export function SettingsCommandPalette({ sections }: Props): React.ReactNode {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Flatten sections → options para filtrar fácil. Conserva groupLabel para
  // posible UI agrupada (no usado hoy pero gratis).
  const options = useMemo<Option[]>(
    () => sections.flatMap((g) => g.items.map((item) => ({ ...item, groupLabel: g.label }))),
    [sections],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.label.toLowerCase().includes(q))
  }, [options, query])

  // Listener Cmd+K / Ctrl+K global. Limitado al scope donde el component
  // está montado (settings) — al desmontar (navegar fuera) el listener se
  // cleanup automáticamente.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Reset query y selectedIndex al abrir/cerrar (UX clásica de palettes).
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      // Auto-focus input cuando abre (aria-friendly: el dialog es modal).
      // Pequeño delay para que Radix haya montado el portal antes del focus.
      const timer = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [open])

  // Cap selectedIndex al length filtrado (evita out-of-bounds al filtrar
  // mientras el index estaba en una posición ahora invisible).
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(0)
    }
  }, [filtered.length, selectedIndex])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filtered[selectedIndex]
      if (item) {
        router.push(item.href)
        setOpen(false)
      }
    }
  }

  return (
    <div className="hidden md:block">
      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:opacity-0 data-[state=open]:opacity-100" />
          <RadixDialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2 rounded-lg border border-neutral-200 bg-white shadow-2xl outline-none"
          >
            <RadixDialog.Title className="sr-only">Buscar configuración</RadixDialog.Title>
            <input
              ref={inputRef}
              role="combobox"
              aria-label="Buscar en configuración"
              aria-expanded="true"
              aria-controls="settings-command-list"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar sección…"
              className="w-full rounded-t-lg border-b border-neutral-200 bg-transparent px-4 py-3 text-base outline-none placeholder:text-neutral-400"
            />
            <ul id="settings-command-list" role="listbox" className="max-h-80 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-3 text-sm text-neutral-500">Sin resultados.</li>
              ) : (
                filtered.map((opt, i) => (
                  <li key={opt.href} role="option" aria-selected={i === selectedIndex}>
                    <Link
                      href={opt.href}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={
                        i === selectedIndex
                          ? 'flex items-center gap-2 bg-neutral-100 px-4 py-2 text-sm text-neutral-900'
                          : 'flex items-center gap-2 px-4 py-2 text-sm text-neutral-700'
                      }
                    >
                      {opt.icon ? (
                        <span className="shrink-0 text-neutral-500" aria-hidden>
                          {opt.icon}
                        </span>
                      ) : null}
                      <span>{opt.label}</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </div>
  )
}
