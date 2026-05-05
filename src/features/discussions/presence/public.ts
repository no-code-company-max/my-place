/**
 * API pública del sub-slice `discussions/presence/`.
 *
 * Tracking de "quién leyó qué y cuándo" — DwellTracker (medición de
 * tiempo en post), PostRead (marca persistida), ThreadPresence (avatares
 * en vivo via Realtime), PostReadersBlock (renderizado del set).
 */

export { DwellTracker } from './ui/dwell-tracker'
export { PostReadersBlock } from './ui/post-readers-block'
export { PostUnreadDot } from './ui/post-unread-dot'
export { ReaderStack } from './ui/reader-stack'
export { ThreadPresence } from './ui/thread-presence'

export { markPostReadAction } from './server/actions/reads'
