import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SidebarSections } from '@/shared/ui/sidebar/sidebar.types'

// Mock Next router (el palette usa useRouter para navegar al item activado)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

import { SettingsCommandPalette } from '../ui/settings-command-palette'

const SECTIONS: SidebarSections = [
  {
    id: 'place',
    label: 'Place',
    items: [
      { href: '/settings/hours', label: 'Horarios' },
      { href: '/settings/access', label: 'Acceso' },
    ],
  },
  {
    id: 'comunidad',
    label: 'Comunidad',
    items: [
      { href: '/settings/members', label: 'Miembros' },
      { href: '/settings/groups', label: 'Grupos' },
    ],
  },
]

afterEach(() => cleanup())

describe('<SettingsCommandPalette>', () => {
  describe('cerrado por default', () => {
    it('NO renderea el dialog hasta que Cmd+K se presiona', () => {
      render(<SettingsCommandPalette sections={SECTIONS} />)
      // Dialog cerrado: no role="dialog" en el DOM
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('Cmd+K abre el palette', () => {
    it('abre el dialog cuando se presiona Cmd+K (Mac) o Ctrl+K (Windows/Linux)', () => {
      render(<SettingsCommandPalette sections={SECTIONS} />)
      // Simular Cmd+K (metaKey en Mac)
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('abre el dialog cuando se presiona Ctrl+K (no-Mac)', () => {
      render(<SettingsCommandPalette sections={SECTIONS} />)
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('NO abre con solo "k" (sin modifier)', () => {
      render(<SettingsCommandPalette sections={SECTIONS} />)
      fireEvent.keyDown(window, { key: 'k' })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('NO abre con Cmd+otra-tecla (solo K)', () => {
      render(<SettingsCommandPalette sections={SECTIONS} />)
      fireEvent.keyDown(window, { key: 'a', metaKey: true })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('search + filter', () => {
    function openPalette() {
      render(<SettingsCommandPalette sections={SECTIONS} />)
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
    }

    it('renderea input de search con aria-label', () => {
      openPalette()
      const input = screen.getByRole('combobox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-label', expect.stringMatching(/buscar|search/i))
    })

    it('lista todos los items cuando query está vacío', () => {
      openPalette()
      const links = screen.getAllByRole('option')
      expect(links).toHaveLength(4) // hours, access, members, groups
    })

    it('filtra items cuando se escribe en el input (case-insensitive)', () => {
      openPalette()
      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: 'mie' } })
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(1)
      expect(options[0]?.textContent).toMatch(/Miembros/i)
    })

    it('filtra por label, no por href slug', () => {
      openPalette()
      const input = screen.getByRole('combobox')
      // 'Horarios' label vs 'hours' slug — busco por label
      fireEvent.change(input, { target: { value: 'Horarios' } })
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(1)
      expect(options[0]?.textContent).toMatch(/Horarios/i)
    })

    it('mensaje "Sin resultados" cuando no hay match', () => {
      openPalette()
      const input = screen.getByRole('combobox')
      fireEvent.change(input, { target: { value: 'xxxnomatchxxx' } })
      expect(screen.queryByRole('option')).not.toBeInTheDocument()
      expect(screen.getByText(/sin resultados/i)).toBeInTheDocument()
    })
  })

  describe('keyboard nav', () => {
    function openPalette() {
      render(<SettingsCommandPalette sections={SECTIONS} />)
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
    }

    it('primer item está aria-selected al abrir', () => {
      openPalette()
      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'true')
      expect(options[1]).toHaveAttribute('aria-selected', 'false')
    })

    it('ArrowDown selecciona el siguiente item', () => {
      openPalette()
      const input = screen.getByRole('combobox')
      fireEvent.keyDown(input, { key: 'ArrowDown' })
      const options = screen.getAllByRole('option')
      expect(options[0]).toHaveAttribute('aria-selected', 'false')
      expect(options[1]).toHaveAttribute('aria-selected', 'true')
    })

    it('ArrowUp selecciona el item anterior (con wrap-around al final)', () => {
      openPalette()
      const input = screen.getByRole('combobox')
      fireEvent.keyDown(input, { key: 'ArrowUp' })
      const options = screen.getAllByRole('option')
      // Wrap-around: del primer item, ArrowUp va al último
      expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('responsive', () => {
    it('palette wrapper tiene hidden md:block (mobile-hidden)', () => {
      const { container } = render(<SettingsCommandPalette sections={SECTIONS} />)
      const wrapper = container.firstElementChild
      expect(wrapper?.className).toMatch(/hidden/)
      expect(wrapper?.className).toMatch(/md:block/)
    })
  })
})
