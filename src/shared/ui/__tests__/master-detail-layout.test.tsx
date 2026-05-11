import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MasterDetailLayout } from '../master-detail-layout'

afterEach(() => cleanup())

describe('<MasterDetailLayout> primitive', () => {
  it('renderea ambos slots (master + detail) cuando hay contenido', () => {
    render(
      <MasterDetailLayout
        master={<div data-testid="master">Lista</div>}
        detail={<div data-testid="detail">Detalle</div>}
      />,
    )
    expect(screen.getByTestId('master')).toBeInTheDocument()
    expect(screen.getByTestId('detail')).toBeInTheDocument()
  })

  describe('responsive', () => {
    it('aplica grid responsive en desktop (md:grid md:grid-cols-[360px_1fr])', () => {
      const { container } = render(
        <MasterDetailLayout master={<div>Lista</div>} detail={<div>Detalle</div>} />,
      )
      const root = container.firstElementChild as HTMLElement
      // En desktop: grid de 2 columnas (360px master + 1fr detail)
      expect(root.className).toContain('md:grid')
      expect(root.className).toMatch(/md:grid-cols-\[360px_1fr\]/)
    })

    it('mobile: master full-width, detail oculto cuando hasDetail=false', () => {
      const { container } = render(
        <MasterDetailLayout
          master={<div data-testid="master">Lista</div>}
          detail={<div data-testid="detail">Detalle</div>}
          hasDetail={false}
        />,
      )
      const detailWrapper = container.querySelector('[data-pane="detail"]')
      expect(detailWrapper?.className).toMatch(/hidden/)
      // En desktop sigue visible (md:block)
      expect(detailWrapper?.className).toMatch(/md:block/)
    })

    it('mobile con hasDetail=true: master oculto, detail full', () => {
      const { container } = render(
        <MasterDetailLayout
          master={<div data-testid="master">Lista</div>}
          detail={<div data-testid="detail">Detalle</div>}
          hasDetail={true}
        />,
      )
      const masterWrapper = container.querySelector('[data-pane="master"]')
      expect(masterWrapper?.className).toMatch(/hidden/)
      expect(masterWrapper?.className).toMatch(/md:block/)
    })

    it('default hasDetail=false: master visible mobile, detail oculto', () => {
      const { container } = render(
        <MasterDetailLayout
          master={<div data-testid="master">Lista</div>}
          detail={<div data-testid="detail">Detalle</div>}
        />,
      )
      const masterWrapper = container.querySelector('[data-pane="master"]')
      const detailWrapper = container.querySelector('[data-pane="detail"]')
      expect(masterWrapper?.className).not.toMatch(/^hidden/)
      expect(detailWrapper?.className).toMatch(/hidden/)
    })
  })

  describe('accessibility', () => {
    it('master pane tiene aria-label "Lista"', () => {
      render(<MasterDetailLayout master={<div>Lista</div>} detail={<div>Detalle</div>} />)
      expect(screen.getByRole('region', { name: /lista/i })).toBeInTheDocument()
    })

    it('detail pane tiene aria-label "Detalle"', () => {
      render(<MasterDetailLayout master={<div>Lista</div>} detail={<div>Detalle</div>} />)
      expect(screen.getByRole('region', { name: /detalle/i })).toBeInTheDocument()
    })

    it('aria-labels custom via props', () => {
      render(
        <MasterDetailLayout
          master={<div>x</div>}
          detail={<div>y</div>}
          masterLabel="Miembros del place"
          detailLabel="Miembro seleccionado"
        />,
      )
      expect(screen.getByRole('region', { name: 'Miembros del place' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Miembro seleccionado' })).toBeInTheDocument()
    })
  })

  describe('estructura', () => {
    it('master pane tiene border-r en desktop (separador visual)', () => {
      const { container } = render(
        <MasterDetailLayout master={<div>Lista</div>} detail={<div>Detalle</div>} />,
      )
      const masterPane = container.querySelector('[data-pane="master"]')
      expect(masterPane?.className).toMatch(/md:border-r/)
    })
  })
})
