'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * Search bar del directorio (M.5). URL state via `?q=...` — el filtro
 * sobrevive a refresh y al back button del browser.
 *
 * **Debounce 300ms**: cada keystroke actualiza el estado local pero el
 * `router.push` se dispara con `setTimeout` reseteado en cada input.
 * Evita spam de revalidación del Server Component padre. Patrón
 * referencia: `discussions/threads/ui/thread-filter-pills.tsx` (el pills
 * no debouncea porque cada click es una intención discreta — el typing
 * sí lo necesita).
 *
 * **Conserva otros params**: clona los `useSearchParams()` actuales
 * antes de actualizar `q`, así filtros activos no se pisan.
 *
 * **`router.replace` (no `push`)**: tipear no debería pollutar el
 * history — el filter cambia el view de la misma página. Mismo
 * criterio que `thread-filter-pills`.
 */
const DEBOUNCE_MS = 300

export function MemberSearchBar(): React.ReactNode {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialQ = searchParams.get('q') ?? ''
  const [value, setValue] = useState(initialQ)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPushedRef = useRef(initialQ)

  // Sync con URL cuando cambia desde afuera (e.g., usuario tocó "Limpiar
  // filtros" en otro componente, o navegó back). Sin esto, el input
  // queda con un valor stale.
  useEffect(() => {
    const fromUrl = searchParams.get('q') ?? ''
    if (fromUrl !== lastPushedRef.current) {
      lastPushedRef.current = fromUrl
      setValue(fromUrl)
    }
  }, [searchParams])

  // Cleanup del timer al desmontar.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const scheduleUpdate = (next: string): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      pushQuery(next)
    }, DEBOUNCE_MS)
  }

  const pushQuery = (next: string): void => {
    const trimmed = next.trim()
    if (trimmed === lastPushedRef.current) return
    lastPushedRef.current = trimmed
    const params = new URLSearchParams(searchParams.toString())
    if (trimmed.length === 0) {
      params.delete('q')
    } else {
      params.set('q', trimmed)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const next = e.target.value
    setValue(next)
    scheduleUpdate(next)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (timerRef.current) clearTimeout(timerRef.current)
    pushQuery(value)
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex">
      <label htmlFor="member-search" className="sr-only">
        Buscar miembros
      </label>
      <input
        id="member-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        placeholder="Buscar por nombre o handle…"
        maxLength={60}
        className="block min-h-[44px] w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
      />
    </form>
  )
}
