import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !ANON_KEY) {
  // Hilfreicher Hinweis im Dev-Modus, falls .env fehlt.
  console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen (.env).')
}

/**
 * Supabase-Client mit unserem Session-Token als Authorization-Header,
 * damit die RLS-Claims greifen. Wird bei Token-Wechsel neu erzeugt.
 */
export function makeClient(token: string | null): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  })
}
