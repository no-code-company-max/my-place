import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { clientEnv, serverEnv } from '@/shared/config/env'

/**
 * Cliente Supabase con service-role key. Bypassa RLS.
 *
 * ⚠️  Usar SOLO en:
 * - Route handlers bajo `src/app/api/`
 * - Código server bajo `src/features/*\/server/`
 * - Jobs cron / scripts
 *
 * Nunca importar desde Client Components. La regla está reforzada por:
 * 1. `import 'server-only'` (falla el build si se incluye en bundle cliente)
 * 2. Regla ESLint en `eslint.config.mjs`
 */
export function createSupabaseAdmin() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
