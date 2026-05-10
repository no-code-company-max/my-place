import { NextResponse, type NextRequest } from 'next/server'

/**
 * DEBUG TEMPORAL — endpoint de test para verificar si Safari iOS acepta
 * cookies con `Domain=<apex>` setteadas desde `www.<apex>`. Setea una
 * cookie de test, retorna 200. User abre /api/debug-cookies después para
 * ver si la cookie persistió.
 */
export function GET(req: NextRequest) {
  const apex = 'place.community'
  const res = NextResponse.json(
    {
      ts: new Date().toISOString(),
      host: req.headers.get('host'),
      message:
        'Cookie de test setteada. Abrí /api/debug-cookies para verificar si Safari la guardó.',
    },
    { headers: { 'cache-control': 'no-store' } },
  )

  // Setea 3 cookies de test con Domains distintos para identificar cuáles
  // Safari acepta.
  res.cookies.set('test-cookie-apex', `apex-${Date.now()}`, {
    domain: apex,
    path: '/',
    maxAge: 60 * 5,
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
  })

  res.cookies.set('test-cookie-host', `host-${Date.now()}`, {
    path: '/',
    maxAge: 60 * 5,
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
  })

  res.cookies.set('test-cookie-subdomain', `sub-${Date.now()}`, {
    domain: `app.${apex}`,
    path: '/',
    maxAge: 60 * 5,
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
  })

  return res
}
