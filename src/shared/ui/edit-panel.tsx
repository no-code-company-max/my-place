'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { useEffect, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

/**
 * Panel responsive de edit/add. Hereda mobile-first del `<BottomSheet>` y
 * extiende a desktop como side drawer (right slide-in 520px). UN solo
 * componente, dos layouts via clases CSS Tailwind — sin `useMediaQuery`,
 * sin hydration mismatch.
 *
 * **Cuándo usar:** forms con ≥2 inputs invocados desde una list/row en
 * `/settings/*`. En desktop, el side drawer mantiene visible la lista de
 * fondo (Smashing 2026 decision tree); en mobile, el bottom sheet ancla
 * los CTAs en thumb-zone.
 *
 * **Cuándo NO usar:** ver `<BottomSheet>` y `<Dialog>` para casos
 * (confirms, single-input prompts, full-page wizards).
 *
 * Mantiene la API estructural de `<BottomSheet>` (Header / Title /
 * Description / Body / Footer) para que migrar de uno a otro sea drop-in.
 *
 * Wraps Radix Dialog: focus trap, ESC, aria-modal, return focus, portal.
 *
 * Z-index: 50 (mismo que `<Dialog>` y `<BottomSheet>`). `<Toaster />` queda
 * en 60 — sigue siendo el top.
 *
 * **Animations (2026-05-12 v4):** keyframes definidos en `globals.css` con
 * selector `.edit-panel-content[data-state]` directo (no via plugin). Para
 * que el close funcione, usamos `forceMount` en Portal/Overlay/Content:
 * Radix mantiene el elemento en DOM siempre, y los keyframes CSS responden
 * al cambio de `data-state`. `animation-fill-mode: forwards` mantiene el
 * estado final del keyframe.
 *
 * Ver `docs/research/2026-05-10-settings-desktop-ux-research.md` § "Edit
 * forms desktop" y `docs/plans/2026-05-10-settings-desktop-redesign.md`
 * § "Sesión 2".
 */

export const EditPanel = RadixDialog.Root
export const EditPanelTrigger = RadixDialog.Trigger
export const EditPanelPortal = RadixDialog.Portal
export const EditPanelClose = RadixDialog.Close

type EditPanelContentProps = ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
  children: ReactNode
}

/**
 * Container del panel.
 *
 * - **Mobile (default)**: anchored bottom, max-h 85vh, rounded-top, slide
 *   bottom → top abrir / top → bottom cerrar.
 * - **Desktop (`md:`)**: anchored right, full height, fixed width 520px,
 *   slide right → left abrir / left → right cerrar.
 *
 * Las animations vienen de la clase `edit-panel-content` definida en
 * `globals.css`. `forceMount` en Portal/Overlay/Content garantiza que
 * Radix NO desmonte automáticamente — el DOM persiste hasta que el
 * componente padre cierre. Animations responden a `data-state` que sí
 * cambia correctamente.
 *
 * Children deben estructurarse con `<EditPanelHeader>`, `<EditPanelBody>`,
 * `<EditPanelFooter>`.
 */
export function EditPanelContent({ children, className = '', ...rest }: EditPanelContentProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // DEBUG TEMPORAL (2026-05-12 v4): logs granulares para diagnosticar
  // el bug del close. Mantener hasta que el user confirme que las
  // animations open + close funcionan visualmente.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ts = () => `+${performance.now() | 0}ms`

    console.log(`[EditPanel ${ts()}] mount useEffect`)

    function snapshot(label: string, el: HTMLElement | null): void {
      if (!el) {
        console.warn(`[EditPanel ${ts()}] ${label}: el is null`)
        return
      }
      const cs = window.getComputedStyle(el)
      console.log(`[EditPanel ${ts()}] ${label}:`, {
        dataState: el.getAttribute('data-state'),
        animationName: cs.animationName,
        animationDuration: cs.animationDuration,
        animationFillMode: cs.animationFillMode,
        animationPlayState: cs.animationPlayState,
        animationDelay: cs.animationDelay,
        animationIterationCount: cs.animationIterationCount,
        transform: cs.transform,
        opacity: cs.opacity,
        display: cs.display,
        visibility: cs.visibility,
        classList: Array.from(el.classList),
      })
    }

    // Listener GLOBAL en document — captura ANY animation event, no perdemos nada
    function onAnimStart(e: AnimationEvent): void {
      const target = e.target as HTMLElement
      if (
        !target.classList?.contains('edit-panel-content') &&
        !target.classList?.contains('edit-panel-overlay')
      ) {
        return
      }
      console.log(`[EditPanel ${ts()}] animationstart:`, {
        name: e.animationName,
        target: target.className,
        dataState: target.getAttribute('data-state'),
      })
    }
    function onAnimEnd(e: AnimationEvent): void {
      const target = e.target as HTMLElement
      if (
        !target.classList?.contains('edit-panel-content') &&
        !target.classList?.contains('edit-panel-overlay')
      ) {
        return
      }
      console.log(`[EditPanel ${ts()}] animationend:`, {
        name: e.animationName,
        target: target.className,
        dataState: target.getAttribute('data-state'),
      })
    }
    function onAnimCancel(e: AnimationEvent): void {
      const target = e.target as HTMLElement
      console.warn(`[EditPanel ${ts()}] animationcancel:`, {
        name: e.animationName,
        target: target.className,
        dataState: target.getAttribute('data-state'),
      })
    }
    document.addEventListener('animationstart', onAnimStart, true)
    document.addEventListener('animationend', onAnimEnd, true)
    document.addEventListener('animationcancel', onAnimCancel, true)

    // MutationObserver en BODY — captura agregar/quitar elementos en cualquier lado
    // del árbol (Radix Portal anida en body). Si el elemento se desmonta sin que
    // veamos data-state="closed", lo vemos acá.
    const bodyObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== 'childList') continue
        m.removedNodes.forEach((n) => {
          if (n instanceof HTMLElement && n.classList.contains('edit-panel-content')) {
            console.log(`[EditPanel ${ts()}] REMOVED edit-panel-content from DOM`, {
              dataState: n.getAttribute('data-state'),
            })
          }
        })
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement && n.classList.contains('edit-panel-content')) {
            console.log(`[EditPanel ${ts()}] ADDED edit-panel-content to DOM`, {
              dataState: n.getAttribute('data-state'),
            })
          }
        })
      }
    })
    bodyObserver.observe(document.body, { childList: true, subtree: true })

    // MutationObserver en el elemento mismo — captura cambios de data-state
    requestAnimationFrame(() => {
      const el =
        contentRef.current ??
        (document.querySelector('.edit-panel-content[data-state]') as HTMLElement | null)
      if (!el) {
        console.warn(`[EditPanel ${ts()}] no encontré .edit-panel-content`)
        return
      }
      snapshot('initial (after RAF)', el)

      const attrObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'data-state') {
            console.log(`[EditPanel ${ts()}] data-state ATTRIBUTE CHANGED`)
            snapshot('post state-change', el)
          }
        }
      })
      attrObserver.observe(el, { attributes: true, attributeFilter: ['data-state'] })
    })

    return () => {
      console.log(`[EditPanel ${ts()}] cleanup useEffect`)
      document.removeEventListener('animationstart', onAnimStart, true)
      document.removeEventListener('animationend', onAnimEnd, true)
      document.removeEventListener('animationcancel', onAnimCancel, true)
      bodyObserver.disconnect()
    }
  }, [])

  return (
    <EditPanelPortal forceMount>
      <RadixDialog.Overlay
        forceMount
        className="edit-panel-overlay fixed inset-0 z-50 bg-black/40 data-[state=closed]:pointer-events-none"
      />
      <RadixDialog.Content
        ref={contentRef}
        forceMount
        className={`edit-panel-content fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t shadow-2xl outline-none data-[state=closed]:pointer-events-none md:bottom-0 md:left-auto md:right-0 md:top-0 md:h-screen md:max-h-screen md:w-[520px] md:rounded-none md:border-l md:border-t-0 ${className}`}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        {...rest}
      >
        {/* Drag handle visual mobile-only (affordance bottom-sheet). En desktop
            el side drawer se cierra por X / ESC / backdrop, sin handle. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full md:hidden"
          style={{ backgroundColor: 'var(--border)' }}
        />
        {children}
      </RadixDialog.Content>
    </EditPanelPortal>
  )
}

/**
 * Header con title + botón de cerrar (X). `<EditPanelTitle>` es mandatory
 * adentro para satisfacer Radix Dialog `aria-labelledby`.
 */
export function EditPanelHeader({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 px-4 pb-3 pt-4 md:px-6 md:pt-6 ${className}`}
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

export function EditPanelTitle(props: ComponentPropsWithoutRef<typeof RadixDialog.Title>) {
  const { className = '', ...rest } = props
  return (
    <RadixDialog.Title
      className={`font-serif text-lg leading-tight md:text-xl ${className}`}
      style={{ color: 'var(--text)' }}
      {...rest}
    />
  )
}

export function EditPanelDescription(
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
 * Body scrollable. Padding horizontal aumenta en desktop (md:px-6) para
 * respiración consistente con el side drawer más ancho.
 */
export function EditPanelBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex-1 overflow-y-auto px-4 py-2 md:px-6 md:py-4 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Footer sticky con CTAs primary/secondary. `safe-area-inset-bottom` heredado
 * del Content cubre el home indicator iOS en mobile.
 */
export function EditPanelFooter({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex shrink-0 flex-col gap-2 border-t px-4 pb-4 pt-3 md:px-6 md:pb-6 ${className}`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      {children}
    </div>
  )
}
