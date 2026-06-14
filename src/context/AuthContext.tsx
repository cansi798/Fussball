import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Membership, Rolle, Session } from '../lib/types'
import { makeClient } from '../lib/supabase'
import { loadSession, saveSession } from '../lib/session'
import { apiLogin, apiRegister, apiMembership, apiSync, type KindForm, type PartnerForm } from '../lib/api'

/** Liest die Claims aus einem JWT (ohne Signaturprüfung – nur zum Anzeigen). */
function decodeClaims(token: string): any {
  const p = token.split('.')[1]
  const pad = p.length % 4 ? '='.repeat(4 - (p.length % 4)) : ''
  const json = atob((p.replace(/-/g, '+').replace(/_/g, '/')) + pad)
  return JSON.parse(json)
}

function sessionFrom(resp: { token: string; verein?: string | null; memberships?: Membership[] }): Session {
  const c = decodeClaims(resp.token)
  return {
    token: resp.token,
    vorname: c.vorname,
    rolle: c.rolle as Rolle,
    verein: resp.verein ?? null,
    verein_id: c.verein_id ?? null,
    teilnehmer_id: c.teilnehmer_id,
    haushalt: c.haushalt ?? null,
    memberships: resp.memberships ?? [],
  }
}

interface AuthCtxValue {
  session: Session | null
  supabase: SupabaseClient
  login: (username: string, pin: string) => Promise<void>
  register: (input: {
    einladungscode: string; username: string; pin: string
    vorname: string; nachname?: string; haushalt: string; kinder?: KindForm[]; partner?: PartnerForm
  }) => Promise<void>
  applyToken: (token: string, verein?: string | null) => void
  switchVerein: (teilnehmerId: string) => Promise<void>
  joinVerein: (code: string, opts?: { mitKinder?: boolean; mitPartner?: boolean; mitTipps?: boolean }) => Promise<void>
  logout: () => void
  /** Zähler, der nach jedem Sync hochzählt – Seiten hängen ihre Lade-Effekte daran. */
  dataVersion: number
  /** true, während ein Sync läuft (für Buttons/Spinner). */
  syncing: boolean
  /** Stößt OpenLigaDB-Sync an und signalisiert danach allen Seiten ein Neuladen. */
  refreshData: () => Promise<void>
}

const AuthCtx = createContext<AuthCtxValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const supabase = useMemo(() => makeClient(session?.token ?? null), [session?.token])
  const [dataVersion, setDataVersion] = useState(0)
  const [syncing, setSyncing] = useState(false)

  function apply(s: Session | null) {
    saveSession(s)
    setSession(s)
  }

  const token = session?.token ?? null
  // Stabil über Renders hinweg, abhängig nur vom Token (für Effekt-Deps in Layout).
  const refreshData = useCallback(async () => {
    if (!token) return
    setSyncing(true)
    try {
      await apiSync(token)
    } catch {
      // Sync-Fehler (z. B. OpenLigaDB kurz down) sollen das Neuladen nicht blockieren:
      // Daten werden trotzdem frisch aus der DB geholt (evtl. hat ein anderer Client synct).
    } finally {
      setSyncing(false)
      setDataVersion((v) => v + 1)
    }
  }, [token])

  const value: AuthCtxValue = {
    session,
    supabase,
    async login(username, pin) {
      const resp = await apiLogin(username, pin)
      apply(sessionFrom(resp))
    },
    async register(input) {
      const resp = await apiRegister(input)
      apply(sessionFrom(resp))
    },
    applyToken(token, verein) { apply(sessionFrom({ token, verein })) },
    async switchVerein(teilnehmerId) {
      const resp = await apiMembership('switch', { teilnehmer_id: teilnehmerId }, session!.token)
      apply(sessionFrom(resp))
    },
    async joinVerein(code, opts) {
      const resp = await apiMembership('join', { einladungscode: code, ...(opts ?? {}) }, session!.token)
      apply(sessionFrom(resp))
    },
    logout() { apply(null) },
    dataVersion,
    syncing,
    refreshData,
  }

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthCtxValue {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden')
  return ctx
}
