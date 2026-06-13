// Passwort-/Code-Hashing mit PBKDF2-SHA256 über die Web Crypto API.
// Kein externes Modul nötig -> robust in Deno-Edge-Functions.
// Format: pbkdf2$<iterationen>$<salt_b64>$<hash_b64>

const ITER = 100_000
const enc = new TextEncoder()

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

async function derive(plain: string, salt: Uint8Array, iter: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    key,
    256,
  )
}

export async function hashSecret(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derive(plain, salt, ITER)
  return `pbkdf2$${ITER}$${b64(salt.buffer)}$${b64(bits)}`
}

export async function verifySecret(plain: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2') return false
  const bits = await derive(plain, unb64(saltB64), Number(iterStr))
  const a = new Uint8Array(bits)
  const b = unb64(hashB64)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Normalisiert Einladungscodes (Groß-/Kleinschreibung & Leerzeichen egal).
export function normCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}
