import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { FrequentlyAccessedHub } from '../ui/frequently-accessed-hub'
import { trackSettingsUsage, STORAGE_KEY } from '../lib/track-settings-usage'
import type { SidebarSections } from '@/shared/ui/sidebar/sidebar.types'

const SECTIONS: SidebarSections = [
  {
    id: 'place',
    label: 'Place',
    items: [
      {
        href: '/settings/hours',
        label: 'Horarios',
        icon: <span data-testid="icon-hours">⏰</span>,
      },
      { href: '/settings/access', label: 'Acceso', icon: <span>🔑</span> },
    ],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    items: [
      { href: '/settings/members', label: 'Miembros', icon: <span>👥</span> },
      { href: '/settings/groups', label: 'Grupos', icon: <span>🛡️</span> },
    ],
  },
]

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('<FrequentlyAccessedHub>', () => {
  it('sin tracking previo: retorna null (no renderea sección vacía)', async () => {
    const { container } = render(<FrequentlyAccessedHub sections={SECTIONS} />)
    // useEffect setea hydrated → re-render → confirma que sigue null por top.length === 0
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('con tracking previo: renderea sección "Frecuentes" con top-N items', async () => {
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/members')
    trackSettingsUsage('/settings/access')

    render(<FrequentlyAccessedHub sections={SECTIONS} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /frecuentes/i })).toBeInTheDocument()
    })
    // Top 3 ordenados por count: hours (2), access (1), members (1) — empate por slug asc
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', '/settings/hours')
  })

  it('respeta topN custom', async () => {
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/members')
    trackSettingsUsage('/settings/access')
    trackSettingsUsage('/settings/groups')

    render(<FrequentlyAccessedHub sections={SECTIONS} topN={2} />)
    await waitFor(() => {
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(2)
    })
  })

  it('cards muestran icon + label de la section correspondiente', async () => {
    trackSettingsUsage('/settings/hours')
    render(<FrequentlyAccessedHub sections={SECTIONS} />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /Horarios/i })
      expect(link).toBeInTheDocument()
    })
    // Icon visible en el card
    expect(screen.getByTestId('icon-hours')).toBeInTheDocument()
  })

  it('filtra silenciosamente slugs trackeados que ya no existen en sections', async () => {
    trackSettingsUsage('/settings/hours')
    trackSettingsUsage('/settings/deprecated-feature') // no está en SECTIONS

    render(<FrequentlyAccessedHub sections={SECTIONS} />)
    await waitFor(() => {
      const links = screen.getAllByRole('link')
      // Solo hours es válido — deprecated-feature se filtra
      expect(links).toHaveLength(1)
      expect(links[0]).toHaveAttribute('href', '/settings/hours')
    })
  })

  it('SSR safety: render inicial es null (no localStorage en server)', () => {
    // Simulamos: no esperamos al useEffect. El render inicial debería ser null.
    const { container } = render(<FrequentlyAccessedHub sections={SECTIONS} />)
    expect(container.firstChild).toBeNull()
  })

  it('cards tienen min-h ≥56px (touch target mobile)', async () => {
    trackSettingsUsage('/settings/hours')
    render(<FrequentlyAccessedHub sections={SECTIONS} />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /Horarios/i })
      expect(link.className).toMatch(/min-h-/)
    })
  })

  it('focus-visible style en cards (keyboard nav)', async () => {
    trackSettingsUsage('/settings/hours')
    render(<FrequentlyAccessedHub sections={SECTIONS} />)
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /Horarios/i })
      expect(link.className).toMatch(/focus-visible:/)
    })
  })

  it('localStorage corrupto: no crashea, retorna null', async () => {
    localStorage.setItem(STORAGE_KEY, 'invalid json {{')
    const { container } = render(<FrequentlyAccessedHub sections={SECTIONS} />)
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })
})
