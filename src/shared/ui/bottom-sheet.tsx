'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Bottom sheet mobile-first. Wraps Radix Dialog con estética anclada al
 * bottom del viewport — patrón canónico para forms de "agregar / editar"
 * en pantallas pequeñas (NN/g, Material 3).
 *
 * Co-existe con `<Dialog>` (centered modal) — usar `<BottomSheet>` cuando:
 *  - el contenido es un form con varios inputs.
 *  - el viewport mobile es el caso primario.
 *  - el thumb-zone (mitad inferior de la pantalla) importa para CTAs.
 *
 * Wraps Radix por:
 *  - focus trap, ESC, aria-modal automáticos.
 *  - return focus al trigger al cerrar.
 *  - portal handling.
 *
 * Decisiones de diseño:
 *  - **Drag handle visible** arriba (affordance de "esto se puede cerrar
 *    arrastrando"). Pero NO confiamos en swipe-only — siempre hay un
 *    `<BottomSheetClose>` (X) explícito (NN/g insiste por accesibilidad).
 *  - **`max-h-[85vh]` + scroll interno** del content area. Sin esto, sheets
 *    largos (ej: muchos toggles) tapan el contenido de fondo y rompen la
 *    referencia visual.
 *  - **Sticky footer slot** con `safe-area-inset-bottom` para que el CTA
 *    primary no quede tapado por el home indicator iOS.
 *  - **Animation**: slide-up desde bottom (translateY 100% → 0) + fade del
 *    overlay. Duración 200ms — más rápido que un dialog porque el viewport
 *    cambia menos.
 *
 * Z-index: 50 (mismo que `<Dialog>`). El `<Toaster />` queda en 60 — sigue
 * siendo el top.
 *
 * Ver `docs/decisions/2026-05-03-mobile-first-page-padding.md`.
 */

export const BottomSheet = RadixDialog.Root
export const BottomSheetTrigger = RadixDialog.Trigger
export const BottomSheetPortal = RadixDialog.Portal
export const BottomSheetClose = RadixDialog.Close

function BottomSheetOverlay(props: ComponentPropsWithoutRef<typeof RadixDialog.Overlay>) {
  const { className = '', ...rest } = props
  return (
    <RadixDialog.Overlay
      className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 ${className}`}
      {...rest}
    />
  )
}

type BottomSheetContentProps = ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
  children: ReactNode
}

/**
 * Container del sheet. Children deben estructurarse como:
 *
 * ```tsx
 * <BottomSheetContent>
 *   <BottomSheetHeader>
 *     <BottomSheetTitle>Editar horario</BottomSheetTitle>
 *     <BottomSheetDescription>Lunes</BottomSheetDescription>
 *   </BottomSheetHeader>
 *   <BottomSheetBody>
 *     {/_ form fields _/}
 *   </BottomSheetBody>
 *   <BottomSheetFooter>
 *     <button type="submit">Guardar</button>
 *   </BottomSheetFooter>
 * </BottomSheetContent>
 * ```
 */
export function BottomSheetContent({ children, className = '', ...rest }: BottomSheetContentProps) {
  return (
    <BottomSheetPortal>
      <BottomSheetOverlay />
      <RadixDialog.Content
        className={`fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t shadow-2xl outline-none transition-transform duration-200 data-[state=closed]:translate-y-full data-[state=open]:translate-y-0 ${className}`}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        {...rest}
      >
        {/* Drag handle visual (no funcional — Radix maneja close por backdrop/ESC/X). */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full"
          style={{ backgroundColor: 'var(--border)' }}
        />
        {children}
      </RadixDialog.Content>
    </BottomSheetPortal>
  )
}

/**
 * Header del sheet. Usa `<BottomSheetTitle>` adentro para satisfacer el
 * requisito de accesibilidad de Radix (DialogTitle obligatorio para
 * aria-labelledby).
 */
export function BottomSheetHeader({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 px-4 pb-3 pt-4 ${className}`}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <RadixDialog.Close
        aria-label="Cerrar"
        className="shrink-0 rounded-full p-2 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)]"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </RadixDialog.Close>
    </div>
  )
}

export function BottomSheetTitle(props: ComponentPropsWithoutRef<typeof RadixDialog.Title>) {
  const { className = '', ...rest } = props
  return (
    <RadixDialog.Title
      className={`font-serif text-lg leading-tight ${className}`}
      style={{ color: 'var(--text)' }}
      {...rest}
    />
  )
}

export function BottomSheetDescription(
  props: ComponentPropsWithoutRef<typeof RadixDialog.Description>,
) {
  const { className = '', ...rest } = props
  return (
    <RadixDialog.Description
      className={`mt-1 text-sm ${className}`}
      style={{ color: 'var(--muted)' }}
      {...rest}
    />
  )
}

/**
 * Body scrollable del sheet. Este es el área que crece + se scroll-ea si
 * el contenido excede `85vh`. Padding horizontal `px-4` (16px) consistente
 * con el header.
 */
export function BottomSheetBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`flex-1 overflow-y-auto px-4 py-2 ${className}`}>{children}</div>
}

/**
 * Footer sticky con CTA primary. Padding-bottom heredado de `<BottomSheetContent>`
 * cubre el `safe-area-inset-bottom` del home indicator iOS.
 *
 * Children típicamente son uno o dos `<button>` — el primary fullwidth.
 */
export function BottomSheetFooter({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex shrink-0 flex-col gap-2 border-t px-4 pb-4 pt-3 ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      {children}
    </div>
  )
}
