import { createBrowserClient } from '@supabase/ssr'
import { clientEnv } from '@/shared/config/env'

/**
 * Cliente Supabase para Client Components.
 * Usa la anon key (safe para exponer al browser).
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
