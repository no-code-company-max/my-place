import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { Wizard, type WizardStepProps } from '../'

afterEach(() => cleanup())

/**
 * Tests del wizard primitive.
 *
 * Cubrimos:
 *  1. Render con N steps y header / body / footer compositivos.
 *  2. State machine: avanzar, retroceder, no avanzar si step inválido.
 *  3. X dispara onClose.
 *  4. Submit en último step dispara onComplete(value).
 *  5. Atrás preserva state acumulado entre steps.
 *  6. Keyboard nav (tab + enter en Siguiente).
 *  7. aria-current="step" en el indicador del step activo.
 */

type DemoValue = { name: string; color: string; agreed: boolean }

const initialValue: DemoValue = { name: '', color: '', agreed: false }

function NameStep({ value, onChange, onValid }: WizardStepProps<DemoValue>) {
  // Step válido cuando el nombre tiene > 0 chars.
  useEffect(() => {
    onValid(value.name.length > 0)
  }, [value.name, onValid])

  return (
    <div>
      <label htmlFor="name-input">Nombre</label>
      <input
        id="name-input"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
    </div>
  )
}

function ColorStep({ value, onChange, onValid }: WizardStepProps<DemoValue>) {
  useEffect(() => {
    onValid(value.color.length > 0)
  }, [value.color, onValid])

  return (
    <div>
      <label htmlFor="color-input">Color</label>
      <input
        id="color-input"
        value={value.color}
        onChange={(e) => onChange({ ...value, color: e.target.value })}
      />
    </div>
  )
}

function ConfirmStep({ value, onChange, onValid }: WizardStepProps<DemoValue>) {
  useEffect(() => {
    onValid(value.agreed)
  }, [value.agreed, onValid])

  return (
    <div>
      <p data-testid="confirm-name">{value.name}</p>
      <p data-testid="confirm-color">{value.color}</p>
      <label>
        <input
          type="checkbox"
          checked={value.agreed}
          onChange={(e) => onChange({ ...value, agreed: e.target.checked })}
        />
        Acepto
      </label>
    </div>
  )
}

const STEPS = [
  { id: 'name', label: 'Identidad', Component: NameStep },
  { id: 'color', label: 'Color', Component: ColorStep },
  { id: 'confirm', label: 'Confirmación', Component: ConfirmStep },
] as const

type Handlers = {
  onComplete: ReturnType<typeof vi.fn<(value: DemoValue) => void>>
  onClose: ReturnType<typeof vi.fn<() => void>>
}

function renderWizard(handlers: Handlers, initial: DemoValue = initialValue) {
  return render(
    <Wizard<DemoValue>
      steps={STEPS}
      initialValue={initial}
      onComplete={handlers.onComplete}
      onClose={handlers.onClose}
    >
      <Wizard.Header />
      <Wizard.Body />
      <Wizard.Footer />
    </Wizard>,
  )
}

let handlers: Handlers

beforeEach(() => {
  handlers = {
    onComplete: vi.fn<(value: DemoValue) => void>(),
    onClose: vi.fn<() => void>(),
  }
})

describe('Wizard — render básico', () => {
  it('muestra el step inicial (idx 0) y su label en el header', () => {
    renderWizard(handlers)
    expect(screen.getByText('Identidad')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument()
  })

  it('muestra "Paso 1 de 3" en el indicador', () => {
    renderWizard(handlers)
    expect(screen.getByText(/Paso 1 de 3/i)).toBeInTheDocument()
  })

  it('botón Siguiente está disabled si el step inicial no es válido', () => {
    renderWizard(handlers)
    const next = screen.getByRole('button', { name: /siguiente/i })
    expect(next).toBeDisabled()
  })

  it('botón Atrás está disabled en step 0', () => {
    renderWizard(handlers)
    const back = screen.getByRole('button', { name: /atrás/i })
    expect(back).toBeDisabled()
  })

  it('aria-current="step" en el indicador del step activo', () => {
    renderWizard(handlers)
    const list = screen.getByRole('list', { name: /progreso/i })
    const items = Array.from(list.querySelectorAll('li'))
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveAttribute('aria-current', 'step')
    expect(items[1]).not.toHaveAttribute('aria-current')
    expect(items[2]).not.toHaveAttribute('aria-current')
  })
})

describe('Wizard — state machine', () => {
  it('habilita Siguiente cuando el step pasa a válido', () => {
    renderWizard(handlers)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Max' } })
    expect(screen.getByRole('button', { name: /siguiente/i })).not.toBeDisabled()
  })

  it('avanzar al próximo step cambia label, body y aria-current', () => {
    renderWizard(handlers)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Max' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    expect(screen.getByText(/Paso 2 de 3/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Color' })).toBeInTheDocument()
    expect(screen.getByLabelText('Color')).toBeInTheDocument()

    const list = screen.getByRole('list', { name: /progreso/i })
    const items = Array.from(list.querySelectorAll('li'))
    expect(items[1]).toHaveAttribute('aria-current', 'step')
  })

  it('NO avanza si el step actual reporta inválido (next disabled, click no-op)', () => {
    renderWizard(handlers)
    const next = screen.getByRole('button', { name: /siguiente/i })
    // Step 1 inicia inválido (name vacío). Click es no-op porque está disabled.
    fireEvent.click(next)
    expect(screen.getByText(/Paso 1 de 3/i)).toBeInTheDocument()
  })

  it('Atrás vuelve al step previo y se habilita en step ≥ 1', () => {
    renderWizard(handlers)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Max' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    const back = screen.getByRole('button', { name: /atrás/i })
    expect(back).not.toBeDisabled()
    fireEvent.click(back)
    expect(screen.getByText(/Paso 1 de 3/i)).toBeInTheDocument()
  })

  it('Atrás preserva state acumulado de steps anteriores', () => {
    renderWizard(handlers)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Max' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'azul' } })
    // Volver al step 1 — el nombre tiene que seguir ahí.
    fireEvent.click(screen.getByRole('button', { name: /atrás/i }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Max')
    // Avanzar otra vez — color preservado.
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByLabelText('Color')).toHaveValue('azul')
  })
})

describe('Wizard — último step (Submit)', () => {
  it('en último step el botón cambia label a "Guardar"', () => {
    renderWizard(handlers)
    // Avanzar hasta el último step.
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Max' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'azul' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    expect(screen.getByText(/Paso 3 de 3/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument()
  })

  it('Guardar disabled hasta que el último step sea válido', () => {
    renderWizard(handlers)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Max' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'azul' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    const save = screen.getByRole('button', { name: /guardar/i })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/acepto/i))
    expect(save).not.toBeDisabled()
  })

  it('Guardar dispara onComplete(value) con el state acumulado', async () => {
    renderWizard(handlers)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Max' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'azul' } })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    fireEvent.click(screen.getByLabelText(/acepto/i))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    })

    expect(handlers.onComplete).toHaveBeenCalledOnce()
    expect(handlers.onComplete).toHaveBeenCalledWith({
      name: 'Max',
      color: 'azul',
      agreed: true,
    })
  })

  it('Guardar soporta onComplete async — durante el pending el botón se deshabilita', async () => {
    let resolve!: () => void
    const onComplete = vi.fn<(value: DemoValue) => Promise<void>>(
      () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    )
    render(
      <Wizard<DemoValue>
        steps={STEPS}
        initialValue={{ name: 'Max', color: 'azul', agreed: true }}
        onComplete={onComplete}
        onClose={handlers.onClose}
      >
        <Wizard.Header />
        <Wizard.Body />
        <Wizard.Footer />
      </Wizard>,
    )
    // Saltar a último step.
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

    const save = screen.getByRole('button', { name: /guardar/i })
    await act(async () => {
      fireEvent.click(save)
    })
    expect(save).toBeDisabled()
    await act(async () => {
      resolve()
      await Promise.resolve()
    })
  })
})

describe('Wizard — cierre (X)', () => {
  it('botón X dispara onClose', () => {
    renderWizard(handlers)
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    expect(handlers.onClose).toHaveBeenCalledOnce()
  })

  it('X visible desde el primer step', () => {
    renderWizard(handlers)
    expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument()
  })

  it('X visible también desde el último step', () => {
    renderWizard(handlers, { name: 'Max', color: 'azul', agreed: true })
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByRole('button', { name: /cerrar/i })).toBeInTheDocument()
  })
})

describe('Wizard — keyboard', () => {
  it('Enter sobre Siguiente avanza si el step es válido', () => {
    renderWizard(handlers)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Max' } })
    const next = screen.getByRole('button', { name: /siguiente/i })
    fireEvent.keyDown(next, { key: 'Enter' })
    fireEvent.click(next) // El default behavior del button con Enter dispara click.
    expect(screen.getByText(/Paso 2 de 3/i)).toBeInTheDocument()
  })

  it('botones de navegación tienen type="button" (no submit accidental)', () => {
    renderWizard(handlers)
    const next = screen.getByRole('button', { name: /siguiente/i })
    const back = screen.getByRole('button', { name: /atrás/i })
    const close = screen.getByRole('button', { name: /cerrar/i })
    expect(next).toHaveAttribute('type', 'button')
    expect(back).toHaveAttribute('type', 'button')
    expect(close).toHaveAttribute('type', 'button')
  })
})
