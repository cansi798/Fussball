import { SUPABASE_URL, ANON_KEY } from './supabase'

/** Ruft eine Supabase Edge Function auf und wirft bei Fehlern eine lesbare Meldung. */
export async function callFn<T = any>(name: string, body: unknown, token?: string | null): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as any).error || `Fehler ${res.status}`)
  return data as T
}

// --- Bequeme Wrapper ---
export interface KindForm {
  vorname: string
  nachname?: string
  geburtsjahr?: number
  eigenesLogin?: boolean
  username?: string
  pin?: string
}

export function apiRegister(input: {
  einladungscode: string
  username: string
  pin: string
  vorname: string
  nachname?: string
  haushalt: string
  kinder?: KindForm[]
}) {
  return callFn('register', input)
}

export function apiLogin(username: string, pin: string) {
  return callFn('login', { username, pin })
}

export function apiSync(token: string | null) {
  return callFn('sync', {}, token)
}

export function apiAdmin(action: string, payload: Record<string, unknown>, token: string | null) {
  return callFn('admin', { action, ...payload }, token)
}
