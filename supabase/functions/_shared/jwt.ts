// Signiert ein HS256-JWT mit dem Projekt-JWT-Secret, damit Supabase/PostgREST
// es akzeptiert und die RLS-Claims greifen. Nur Signieren nötig (Supabase prüft).
const enc = new TextEncoder()

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? enc.encode(data) : data
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface AppClaims {
  teilnehmer_id: string
  verein_id: string | null
  rolle: 'kind' | 'elternteil' | 'admin'
  haushalt: string | null
  vorname: string
}

export async function signAppJwt(claims: AppClaims, secret: string, ttlSeconds = 60 * 60 * 24 * 30): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    ...claims,
    role: 'authenticated', // wichtig für Supabase RLS
    aud: 'authenticated',
    iat: now,
    exp: now + ttlSeconds,
  }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(unsigned))
  return `${unsigned}.${b64url(new Uint8Array(sig))}`
}

function unb64url(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  const b = (s.replace(/-/g, '+').replace(/_/g, '/')) + pad
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
}

// Prüft Signatur + Ablauf und gibt die Claims zurück (oder null).
export async function verifyAppJwt(token: string, secret: string): Promise<(AppClaims & { exp: number }) | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, s] = parts
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  )
  const ok = await crypto.subtle.verify('HMAC', key, unb64url(s), enc.encode(`${h}.${p}`))
  if (!ok) return null
  const claims = JSON.parse(new TextDecoder().decode(unb64url(p)))
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null
  return claims
}
