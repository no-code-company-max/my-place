import 'server-only'
import { cache } from 'react'
import { AuthorizationError } from '@/shared/errors/domain-error'
import { createSupabaseServer } from './supabase/server'
import { isStaleSessionError } from './supabase/refresh-token-error'
import { logger } from './logger'

export type AuthUser = { id: string; email: string | null }

/**
 * Sesión activa del request, cacheada via `React.cache`. Cualquier layout, page,
 * loader o RSC puede llamarlo sin disparar round-trips extra al endpoint de
 * Supabase Auth — todas las invocaciones en el mismo render comparten el
 * resultado. Retorna `null` si no hay sesión (el caller decide si redirigir o
 * tirar `AuthorizationError`).
 */
export const getCurrentAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createSupabaseServer()
  // El middleware ya intentó refrescar tokens stale (ver
  // `supabase/middleware.ts`). Si igual llega un AuthApiError de refresh
  // acá, tratarlo como anonymous evita crashear el render — el siguiente
  // hop hará el redirect correspondiente.
  try {
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      // DEBUG TEMPORAL — getUser retornó sin user (sin throw).
      logger.warn(
        { debug: 'AU_getUser_no_user', layer: 'rsc' },
        `DBG AU[getUser-no-user] supabase returned no user without error`,
      )
      return null
    }
    return { id: data.user.id, email: data.user.email ?? null }
  } catch (err) {
    // DEBUG TEMPORAL — capturar TODA la info del error en RSC.
    const e = err as { code?: string; message?: string; name?: string; status?: number }
    logger.warn(
      {
        debug: 'AU_getUser_error',
        layer: 'rsc',
        errName: e?.name ?? null,
        errCode: e?.code ?? null,
        errStatus: e?.status ?? null,
        errMessage: e?.message ?? null,
        isStale: isStaleSessionError(err),
      },
      `DBG AU[getUser-err] name=${e?.name} code=${e?.code} status=${e?.status} msg=${e?.message} stale=${isStaleSessionError(err)}`,
    )
    if (!isStaleSessionError(err)) {
      // DURANTE DIAGNÓSTICO: tratar como anonymous en lugar de propagar
      // (para no crashear el render con error overlay y poder ver el log).
      return null
    }
    logger.warn(
      {
        event: 'authSessionStale',
        layer: 'rsc',
        reason: (err as { code?: string }).code ?? 'unknown',
      },
      'session stale during RSC render — treating as anonymous',
    )
    return null
  }
})

/**
 * Wrapper sobre `getCurrentAuthUser` para server actions: tira
 * `AuthorizationError` con `reason` (mensaje en español, amigable al UI)
 * si no hay sesión. Comparte el cache de `React.cache` — múltiples
 * callsites en el mismo request hacen UN round-trip a Supabase Auth,
 * no N.
 */
export async function requireAuthUserId(reason: string): Promise<string> {
  const user = await getCurrentAuthUser()
  if (!user) throw new AuthorizationError(reason)
  return user.id
}
