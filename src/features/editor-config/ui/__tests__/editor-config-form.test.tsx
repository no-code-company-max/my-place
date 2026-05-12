/**
 * Smoke tests del `EditorConfigForm` post-rediseño "todo manual"
 * (2026-05-12). Cubre:
 *
 *  - render: 4 cards con switches accesibles + Save disabled de arranque
 *  - toggle aplica local (NO autosave) + dirty indicator se activa
 *  - botón "Guardar cambios" se habilita cuando dirty
 *  - submit invoca action con snapshot completo + reset post-success
 *  - error mapping cuando action retorna forbidden
 *
 * Iter previa tenía tests de autosave + soft barrier — eliminados al
 * migrar al save model "todo manual" (canon docs/ux-patterns.md
 * § "Save model — todo manual").
 */

import * as React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

type ActionResult = { ok: true } | { ok: false; error: 'forbidden' | 'invalid' | 'not_found' }

const updateEditorConfigActionFn = vi.fn<(input: unknown) => Promise<ActionResult>>(async () => ({
  ok: true,
}))

vi.mock('../../server/actions', () => ({
  updateEditorConfigAction: (input: unknown) => updateEditorConfigActionFn(input),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
const toastInfo = vi.fn()

vi.mock('@/shared/ui/toaster', () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
    info: (m: string) => toastInfo(m),
  },
}))

import { EditorConfigForm } from '../editor-config-form'

const ALL_TRUE = {
  youtube: true,
  spotify: true,
  applePodcasts: true,
  ivoox: true,
}

describe('EditorConfigForm — save model "todo manual"', () => {
  beforeEach(() => {
    updateEditorConfigActionFn.mockClear()
    updateEditorConfigActionFn.mockResolvedValue({ ok: true })
    toastSuccess.mockClear()
    toastError.mockClear()
    toastInfo.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renderiza 4 cards con switches accesibles + Save disabled inicial', () => {
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    // Cada plugin tiene un switch con role="switch" y aria-label que incluye el nombre
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(4)
    expect(switches[0]?.getAttribute('aria-label')).toMatch(/YouTube/)
    expect(switches[1]?.getAttribute('aria-label')).toMatch(/Spotify/)
    expect(switches[2]?.getAttribute('aria-label')).toMatch(/Apple Podcasts/)
    expect(switches[3]?.getAttribute('aria-label')).toMatch(/iVoox/)
    // Todos inician en ON (initial ALL_TRUE)
    for (const s of switches) {
      expect(s.getAttribute('aria-checked')).toBe('true')
    }
    // Botón Save disabled de arranque
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('toggle aplica solo local (NO invoca action) + habilita el botón Save', async () => {
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    const spotify = screen.getAllByRole('switch')[1]!
    fireEvent.click(spotify)

    // El action NO se invocó — no hay autosave bajo el modelo "todo manual"
    expect(updateEditorConfigActionFn).not.toHaveBeenCalled()

    // El switch refleja el nuevo estado (OFF)
    await waitFor(() => {
      expect(spotify.getAttribute('aria-checked')).toBe('false')
    })

    // El botón Save se habilita
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).not.toBeDisabled()

    // El indicator "• Cambios sin guardar" aparece
    expect(screen.getByText(/Cambios sin guardar/)).toBeInTheDocument()
  })

  it('submit invoca action con snapshot completo + reset post-success', async () => {
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    // Toggle 2 plugins
    fireEvent.click(screen.getAllByRole('switch')[1]!) // Spotify OFF
    fireEvent.click(screen.getAllByRole('switch')[3]!) // iVoox OFF

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateEditorConfigActionFn).toHaveBeenCalledTimes(1)
    })

    const arg = updateEditorConfigActionFn.mock.calls[0]?.[0] as {
      placeId: string
      config: typeof ALL_TRUE
    }
    expect(arg.placeId).toBe('place_1')
    expect(arg.config).toEqual({
      youtube: true,
      spotify: false,
      applePodcasts: true,
      ivoox: false,
    })

    // toast.success disparado
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled()
    })

    // Post-reset: el botón Save vuelve a disabled (form clean)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    })
  })

  it('cero invocaciones de toast.info (soft barrier removido)', () => {
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    // Toggle múltiples sin Save — bajo el modelo previo esto disparaba
    // toast.info(DEFER_HINT). Ahora no debe disparar nada.
    fireEvent.click(screen.getAllByRole('switch')[0]!)
    fireEvent.click(screen.getAllByRole('switch')[1]!)
    fireEvent.click(screen.getAllByRole('switch')[2]!)
    expect(toastInfo).not.toHaveBeenCalled()
    expect(updateEditorConfigActionFn).not.toHaveBeenCalled()
  })

  it('muestra toast.error cuando el action retorna error: forbidden', async () => {
    updateEditorConfigActionFn.mockResolvedValueOnce({ ok: false, error: 'forbidden' })
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    fireEvent.click(screen.getAllByRole('switch')[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
    })
    expect(toastError.mock.calls[0]?.[0]).toMatch(/permiso/i)
  })

  it('switch visual refleja correctamente el estado ON/OFF (aria-checked)', async () => {
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    const youtube = screen.getAllByRole('switch')[0]!
    expect(youtube.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(youtube)
    await waitFor(() => {
      expect(youtube.getAttribute('aria-checked')).toBe('false')
    })
    fireEvent.click(youtube)
    await waitFor(() => {
      expect(youtube.getAttribute('aria-checked')).toBe('true')
    })
  })
})
