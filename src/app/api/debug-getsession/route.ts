import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { clientEnv } from '@/shared/config/env'

/**
 * DEBUG TEMPORAL — invoca getSession() del SDK @supabase/ssr con las cookies
 * del request actual y retorna el JSON COMPLETO de lo que el SDK ve.
 *
 * Bypassed por el middleware (`/api/*` excluido del matcher).
 *
 * Permite distinguir entre:
 * - SDK retorna data.session=null (storageKey mismatch o cookie no encontrada)
 * - SDK retorna data.session populated (entonces el problema está en el MW)
 * - SDK retorna error
 *
 * Trunca strings >40 chars para evitar leak completo del access_token.
 */
export async function GET(req: NextRequest) {
  const ref = clientEnv.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1] ?? '?'
  const allCookies = req.cookies.getAll().map((c) => ({
    name: c.name,
    valueLen: c.value?.length ?? 0,
  }))
  const sbCookies = allCookies.filter((c) => c.name.startsWith('sb-'))

  let cookiesSeenBySdk: { name: string; valueLen: number }[] = []
  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          const all = req.cookies.getAll()
          cookiesSeenBySdk = all.map((c) => ({
            name: c.name,
            valueLen: c.value?.length ?? 0,
          }))
          return all
        },
        setAll() {
          // noop — solo lectura
        },
      },
    },
  )

  let result: unknown
  let errorInfo: unknown = null
  try {
    const { data, error } = await supabase.auth.getSession()
    result = JSON.parse(
      JSON.stringify(data, (_k, v) =>
        typeof v === 'string' && v.length > 40 ? `${v.slice(0, 20)}…(${v.length})` : v,
      ),
    )
    if (error) {
      const e = error as { name?: string; code?: string; status?: number; message?: string }
      errorInfo = {
        name: e.name,
        code: e.code,
        status: e.status,
        message: e.message,
      }
    }
  } catch (err) {
    const e = err as { name?: string; code?: string; status?: number; message?: string }
    errorInfo = {
      caught: true,
      name: e.name,
      code: e.code,
      status: e.status,
      message: e.message,
    }
  }

  return NextResponse.json(
    {
      ts: new Date().toISOString(),
      host: req.headers.get('host'),
      currentRef: ref,
      expectedCookieName: `sb-${ref}-auth-token`,
      totalCookies: allCookies.length,
      sbCookieCount: sbCookies.length,
      sbCookies,
      cookiesSeenBySdk,
      cookiesForCurrentRef: sbCookies.filter((c) => c.name.startsWith(`sb-${ref}-`)),
      sdkResult: result,
      sdkError: errorInfo,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
