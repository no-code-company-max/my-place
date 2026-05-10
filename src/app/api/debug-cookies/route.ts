import { NextResponse, type NextRequest } from 'next/server'

/**
 * DEBUG TEMPORAL — endpoint de diagnóstico de cookies para mobile sin
 * DevTools. Bypassed por el middleware (`/api/*` excluido del matcher).
 * NO leak de values, solo metadata (name + length).
 */
export function GET(req: NextRequest) {
  const cookies = req.cookies.getAll().map((c) => ({
    name: c.name,
    valueLen: c.value?.length ?? 0,
  }))
  const sbCookies = cookies.filter((c) => /^sb-/.test(c.name))

  return NextResponse.json(
    {
      ts: new Date().toISOString(),
      host: req.headers.get('host'),
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      cookieHeaderLength: req.headers.get('cookie')?.length ?? 0,
      totalCookies: cookies.length,
      sbCookieCount: sbCookies.length,
      sbCookies,
      allCookies: cookies,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
