import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'

/**
 * Render helper. Extender con providers (QueryClient, theme) cuando aparezcan.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options)
}

export * from '@testing-library/react'
