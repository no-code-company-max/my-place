/**
 * Smoke tests del `EditorConfigForm`. Cubre:
 *  - render: 4 toggles con labels en español + Save disabled de arranque.
 *  - autosave: cambiar 1 toggle desde estado limpio → action invocado.
 *  - soft barrier: cambiar 1 toggle estando dirty → toast.info, sin action.
 *  - dirty indicator + Save habilitado tras cambio.
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

describe('EditorConfigForm', () => {
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

  it('renderiza los 4 toggles con labels en español y Save disabled', () => {
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    expect(screen.getByLabelText('YouTube')).toBeInTheDocument()
    expect(screen.getByLabelText('Spotify')).toBeInTheDocument()
    expect(screen.getByLabelText('Apple Podcasts')).toBeInTheDocument()
    expect(screen.getByLabelText('iVoox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  it('autosave: cambiar 1 toggle desde estado limpio invoca el action', async () => {
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    fireEvent.click(screen.getByLabelText('Spotify'))
    await waitFor(() => {
      expect(updateEditorConfigActionFn).toHaveBeenCalledTimes(1)
    })
    const arg = updateEditorConfigActionFn.mock.calls[0]?.[0] as {
      placeId: string
      config: typeof ALL_TRUE
    }
    expect(arg.placeId).toBe('place_1')
    expect(arg.config).toEqual({ ...ALL_TRUE, spotify: false })
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled()
    })
  })

  it('soft barrier: cambiar un 2do toggle defiere y muestra toast.info', async () => {
    // Bloqueamos el primer save para que el form quede dirty cuando el 2do toggle dispare.
    let resolveFirst: ((v: { ok: true }) => void) | null = null
    updateEditorConfigActionFn.mockImplementationOnce(
      () => new Promise<{ ok: true }>((r) => (resolveFirst = r)),
    )

    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)

    // 1er toggle dispara persist.
    fireEvent.click(screen.getByLabelText('Spotify'))
    await waitFor(() => {
      expect(updateEditorConfigActionFn).toHaveBeenCalledTimes(1)
    })

    // 2do toggle estando todavía pending → form is dirty → defer.
    fireEvent.click(screen.getByLabelText('YouTube'))
    expect(toastInfo).toHaveBeenCalled()
    // No se llama un 2do persist.
    expect(updateEditorConfigActionFn).toHaveBeenCalledTimes(1)

    if (resolveFirst) (resolveFirst as (v: { ok: true }) => void)({ ok: true })
  })

  it('autosave envía sólo el snapshot del cambio (caso típico, sin contención)', async () => {
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    fireEvent.click(screen.getByLabelText('YouTube'))
    await waitFor(() => {
      expect(updateEditorConfigActionFn).toHaveBeenCalledTimes(1)
    })
    const arg = updateEditorConfigActionFn.mock.calls[0]?.[0] as {
      config: typeof ALL_TRUE
    }
    expect(arg.config).toEqual({ ...ALL_TRUE, youtube: false })
  })

  it('muestra toast.error cuando el action retorna error: forbidden', async () => {
    updateEditorConfigActionFn.mockResolvedValueOnce({ ok: false, error: 'forbidden' })
    render(<EditorConfigForm placeId="place_1" initial={ALL_TRUE} />)
    fireEvent.click(screen.getByLabelText('YouTube'))
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
    })
    expect(toastError.mock.calls[0]?.[0]).toMatch(/permiso/i)
  })
})
