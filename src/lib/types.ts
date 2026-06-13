export type Rolle = 'kind' | 'elternteil' | 'admin'
export type Phase = 'gruppe' | 'ko'
export type Sieger = 'heim' | 'gast'

export interface Membership {
  teilnehmer_id: string
  verein_id: string | null
  verein: string | null
  rolle: Rolle
  haushalt: string | null
  vorname: string
}

export interface Session {
  token: string
  vorname: string
  rolle: Rolle
  verein: string | null
  verein_id: string | null
  teilnehmer_id: string
  haushalt: string | null
  memberships: Membership[]
}

export interface Mannschaft {
  id: string
  openliga_team_id: number | null
  name: string
  kuerzel: string | null
  flagge_url: string | null
}

export interface Spiel {
  id: string
  openliga_match_id: number | null
  heim_id: string | null
  gast_id: string | null
  anstoss: string
  phase: Phase
  tore_heim: number | null
  tore_gast: number | null
  elfmeter_sieger: Sieger | null
  tv_sender: string | null
  ist_beendet: boolean
  heim?: Mannschaft | null
  gast?: Mannschaft | null
}

export interface Tipp {
  id: string
  teilnehmer_id: string
  spiel_id: string
  tipp_heim: number
  tipp_gast: number
  punkte: number
}

export interface Teilnehmer {
  id: string
  vorname: string
  nachname: string | null
  rolle: Rolle
  haushalt: string
  verein_id: string
  geburtsjahr: number | null
  benutzer_id: string | null
}

export interface RanglisteRow {
  teilnehmer_id: string
  verein_id: string
  vorname: string
  nachname: string | null
  rolle: Rolle
  haushalt: string
  punkte: number
  exakt: number
  teiltreffer: number
  tipps_gesamt: number
}
