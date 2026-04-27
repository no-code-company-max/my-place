'use client'

import { motion, useAnimationControls, useReducedMotion, type PanInfo } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { deriveSnapTarget } from '../domain/swiper-snap'
import type { ZoneIndex } from '../domain/zones'

/**
 * Viewport interno del swiper — wraps `{children}` con framer-motion
 * `<motion.div>` para gesture handling. Componente client puro, sin
 * acceso a `next/navigation` (lo maneja el `<ZoneSwiper>` padre).
 *
 * Comportamiento:
 *  - Drag horizontal (`drag="x"`) con constraints dinámicos según
 *    `activeIndex`: en zonas extremas el drag hacia el borde es
 *    elástico (rubber band), en zonas intermedias es libre.
 *  - Al soltar, `deriveSnapTarget` decide si snapear a una zona
 *    vecina o volver al centro. Si snap a otra zona: anima al offset
 *    target (off-screen), luego llama `onSnap`. El padre dispara la
 *    navegación. Cuando children cambia (nueva zona), el viewport
 *    resetea a x=0.
 *  - `useReducedMotion`: si el user tiene la preferencia activa, las
 *    transitions usan `duration: 0` (snap instantáneo). El gesture
 *    sigue funcional.
 *
 * `touch-action: pan-y` + `overscroll-behavior-x: contain` bloquean
 * back-gesture de iOS Safari y pull-to-refresh accidental.
 *
 * Ver `docs/features/shell/spec.md` § 16.3.
 */
type Props = {
  activeIndex: ZoneIndex
  totalZones: number
  children: React.ReactNode
  onSnap: (targetIndex: ZoneIndex) => void
  onPanStart?: () => void
}

const SPRING_TRANSITION = { type: 'spring' as const, stiffness: 350, damping: 35 }

export function SwiperViewport({
  activeIndex,
  totalZones,
  children,
  onSnap,
  onPanStart,
}: Props): React.ReactNode {
  const controls = useAnimationControls()
  const reduceMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  // Mide el viewport para alimentar `deriveSnapTarget` y los
  // dragConstraints dinámicos. Re-mide en resize/rotación.
  useEffect(() => {
    const measure = () => {
      setWidth(containerRef.current?.offsetWidth ?? 0)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Cuando children cambia (router.push completó la navegación), reset
  // visual al centro sin animar (el user ya está visualmente "ahí").
  useEffect(() => {
    controls.set({ x: 0 })
  }, [activeIndex, controls])

  const dragConstraints = useMemo(
    () => ({
      // En zona última, no hay vecino a la derecha del swipe (left drag),
      // así que constraint a 0 → elastic (rubber band).
      left: activeIndex < totalZones - 1 ? -width : 0,
      // En zona primera, no hay vecino a la izquierda (right drag), elastic.
      right: activeIndex > 0 ? width : 0,
    }),
    [activeIndex, totalZones, width],
  )

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const target = deriveSnapTarget({
      currentIndex: activeIndex,
      dragOffsetX: info.offset.x,
      velocityX: info.velocity.x,
      viewportWidth: width,
      totalZones,
    })

    const transition = reduceMotion ? { duration: 0 } : SPRING_TRANSITION

    if (target === activeIndex) {
      // Cancel del swipe (incluye bounce en bordes): vuelve a x=0.
      controls.start({ x: 0, transition })
      return
    }

    // Snap a otra zona: anima off-screen y luego notifica al padre.
    const direction = target > activeIndex ? -1 : 1
    controls.start({ x: direction * width, transition }).then(() => {
      onSnap(target)
    })
  }

  // exactOptionalPropertyTypes: motion.div NO acepta `undefined` para
  // onPanStart, así que solo lo agregamos si el caller pasó callback.
  const optionalMotionProps: { onPanStart?: () => void } = {}
  if (onPanStart) optionalMotionProps.onPanStart = () => onPanStart()

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
    >
      <motion.div
        drag="x"
        dragConstraints={dragConstraints}
        dragElastic={0.2}
        dragMomentum={false}
        animate={controls}
        onDragEnd={handleDragEnd}
        style={{ touchAction: 'pan-y' }}
        {...optionalMotionProps}
      >
        {children}
      </motion.div>
    </div>
  )
}
