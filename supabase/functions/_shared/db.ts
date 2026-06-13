// Supabase-Client mit Service-Role (umgeht RLS) – nur in Edge Functions nutzen.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

// Das JWT-Secret des Projekts (Dashboard -> API -> JWT Secret).
// Muss als Function-Secret gesetzt sein: `supabase secrets set APP_JWT_SECRET=...`
export function jwtSecret(): string {
  const s = Deno.env.get('APP_JWT_SECRET')
  if (!s) throw new Error('APP_JWT_SECRET fehlt')
  return s
}
