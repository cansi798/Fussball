// Sync: holt Spielplan & Ergebnisse aus zwei Quellen.
//   1) OpenLigaDB (kostenlos, ohne Schlüssel) = Basis der GRUPPENPHASE
//      (Mannschaften, Spielplan, TV-Sender). Daran hängen die Tipps.
//   2) ESPN (kostenlos, ohne Schlüssel):
//      - Gruppenphase: Echtzeit-Overlay für Score/ist_beendet/Live-Minute.
//      - K.o.-Phase: pflegt die Spiele komplett (Termin, Teams, Score, Status),
//        eigener Schlüssel espn_event_id. Sobald Teams feststehen, ersetzt ESPN
//        die Platzhalter (z. B. "1C") durch echte Länder -> erscheint automatisch.
// Ergebnis-Updates lösen die Punkte-Neuberechnung per DB-Trigger aus.
// tv_sender bleibt bei Updates unangetastet.
import { serviceClient } from '../_shared/db.ts'
import { json, handleOptions } from '../_shared/cors.ts'

const KO_WORTE = ['achtel', 'viertel', 'halbfinale', 'finale', 'platz 3', 'sechzehntel']
function istKo(groupName?: string): boolean {
  const g = (groupName ?? '').toLowerCase()
  return KO_WORTE.some((w) => g.includes(w))
}

// ESPN nutzt FIFA/Englisch-Codes, OpenLigaDB teils eigene. Alias ESPN -> unser Kürzel.
const ESPN_ALIAS: Record<string, string> = { BIH: 'BHG', HAI: 'HTI', QAT: 'KAT', NED: 'NLD', KSA: 'SAR' }
function ourCode(abbr?: string): string {
  const u = (abbr ?? '').toUpperCase()
  return ESPN_ALIAS[u] ?? u
}

interface OlResult { pointsTeam1: number; pointsTeam2: number; resultName?: string; resultOrderID?: number }
function ergebnisAuswerten(results: OlResult[]): { toreH: number | null; toreG: number | null; elfmeter: 'heim' | 'gast' | null } {
  if (!results || results.length === 0) return { toreH: null, toreG: null, elfmeter: null }
  const sorted = [...results].sort((a, b) => (a.resultOrderID ?? 0) - (b.resultOrderID ?? 0))
  const elf = sorted.find((r) => (r.resultName ?? '').toLowerCase().includes('elfmeter'))
  const verl = sorted.find((r) => (r.resultName ?? '').toLowerCase().includes('verläng'))
  const regulaer = verl ?? [...sorted].reverse().find((r) => r !== elf) ?? sorted[sorted.length - 1]
  let elfmeter: 'heim' | 'gast' | null = null
  if (elf) elfmeter = elf.pointsTeam1 > elf.pointsTeam2 ? 'heim' : 'gast'
  return { toreH: regulaer.pointsTeam1, toreG: regulaer.pointsTeam2, elfmeter }
}

function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

// ESPN-Events: aktuelles Fenster (Gruppen-Live) + komplette K.o.-Liste, dedupliziert.
async function espnEvents(): Promise<any[]> {
  const now = new Date()
  const d = (off: number) => ymdUTC(new Date(now.getTime() + off * 86_400_000))
  const ranges = [`${d(-1)}-${d(1)}`, '20260627-20260720'] // Live-Fenster, K.o.-Phase
  const out = new Map<string, any>()
  for (const range of ranges) {
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${range}`)
      if (!r.ok) continue
      const j = await r.json()
      for (const e of (j.events ?? [])) out.set(e.id, e)
    } catch (_) { /* darf den Sync nicht abbrechen */ }
  }
  return [...out.values()]
}

// Status eines ESPN-Events in unsere Felder übersetzen.
function espnStatus(e: any): { state: string; istBeendet: boolean; liveMin: string | null } {
  const state = e.status?.type?.state // 'pre' | 'in' | 'post'
  const halbzeit = (e.status?.type?.name ?? '').toUpperCase().includes('HALFTIME')
  return {
    state,
    istBeendet: state === 'post',
    liveMin: state === 'in' ? (halbzeit ? 'HZ' : (e.status?.displayClock ?? null)) : null,
  }
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = await req.json().catch(() => ({}))
    const liga = /^[a-zA-Z0-9_]{1,40}$/.test(body.liga ?? '') ? body.liga : 'wm2026'
    const saison = /^\d{4}$/.test(body.saison ?? '') ? body.saison : '2026'
    const db = serviceClient()

    // =================== 1) OpenLigaDB: Gruppenphase-Basis ===================
    const res = await fetch(`https://api.openligadb.de/getmatchdata/${liga}/${saison}`)
    if (!res.ok) return json({ error: `OpenLigaDB antwortet mit ${res.status}` }, 502)
    const matches = (await res.json()) as any[]
    if (!Array.isArray(matches)) return json({ error: 'OpenLigaDB lieferte kein gültiges Format' }, 502)

    const uniqueTeams = new Map<number, any>()
    for (const m of matches) for (const t of [m.team1, m.team2]) {
      if (t?.teamId && !uniqueTeams.has(t.teamId)) uniqueTeams.set(t.teamId, t)
    }
    const teamMap = new Map<number, string>()
    if (uniqueTeams.size > 0) {
      const { data: teamRows, error: teamErr } = await db.from('mannschaft').upsert(
        [...uniqueTeams.values()].map((t) => ({
          openliga_team_id: t.teamId, name: t.teamName, kuerzel: t.shortName ?? null, flagge_url: t.teamIconUrl ?? null,
        })),
        { onConflict: 'openliga_team_id' },
      ).select('id, openliga_team_id')
      if (teamErr) return json({ error: `Teams speichern fehlgeschlagen: ${teamErr.message}` }, 500)
      for (const r of teamRows ?? []) teamMap.set(r.openliga_team_id as number, r.id as string)
    }

    const { data: existingRows } = await db.from('spiel').select('openliga_match_id').not('openliga_match_id', 'is', null)
    const existing = new Set((existingRows ?? []).map((r: any) => r.openliga_match_id))

    const rows: Record<string, unknown>[] = []
    for (const m of matches) {
      const anstoss = m.matchDateTimeUTC ?? m.matchDateTime
      if (!anstoss || m.matchID == null) continue
      const { toreH, toreG, elfmeter } = ergebnisAuswerten(m.matchResults ?? [])
      rows.push({
        openliga_match_id: m.matchID,
        heim_id: teamMap.get(m.team1?.teamId) ?? null, gast_id: teamMap.get(m.team2?.teamId) ?? null,
        anstoss, phase: istKo(m.group?.groupName) ? 'ko' : 'gruppe',
        tore_heim: toreH, tore_gast: toreG, elfmeter_sieger: elfmeter, ist_beendet: !!m.matchIsFinished,
      })
    }
    let neu = 0, aktualisiert = 0
    if (rows.length > 0) {
      const { error: spielErr } = await db.from('spiel').upsert(rows, { onConflict: 'openliga_match_id' })
      if (spielErr) return json({ error: `Spiele speichern fehlgeschlagen: ${spielErr.message}` }, 500)
      for (const r of rows) (existing.has(r.openliga_match_id) ? aktualisiert++ : neu++)
    }

    // =================== 2) ESPN ===================
    let espnAktualisiert = 0, espnLive = 0, koGepflegt = 0, koMitTeams = 0
    try {
      const events = await espnEvents()

      // Kürzel -> mannschaft.id (für K.o.-Team-Zuordnung)
      const { data: alleTeams } = await db.from('mannschaft').select('id, kuerzel')
      const kuerzelToId = new Map<string, string>()
      for (const t of (alleTeams ?? []) as any[]) if (t.kuerzel) kuerzelToId.set(t.kuerzel.toUpperCase(), t.id)

      // Index der GRUPPENspiele nach Team-Paar (für das Live-Overlay)
      const { data: gruppen } = await db.from('spiel')
        .select('id, anstoss, tore_heim, tore_gast, ist_beendet, live_minute, heim:heim_id(kuerzel), gast:gast_id(kuerzel)')
        .eq('phase', 'gruppe')
      const index = new Map<string, any[]>()
      for (const s of (gruppen ?? []) as any[]) {
        const hk = s.heim?.kuerzel, gk = s.gast?.kuerzel
        if (!hk || !gk) continue
        const key = [hk, gk].sort().join('|')
        if (!index.has(key)) index.set(key, [])
        index.get(key)!.push(s)
      }

      const koRows: Record<string, unknown>[] = []
      for (const e of events) {
        const comp = e.competitions?.[0]
        const teams = comp?.competitors ?? []
        if (teams.length !== 2) continue
        const { state, istBeendet, liveMin } = espnStatus(e)
        const istGruppe = (e.season?.slug ?? '') === 'group-stage'

        if (istGruppe) {
          // --- Gruppenphase: nur Live/Endstand auf OpenLigaDB-Spiel überlagern ---
          if (state !== 'in' && state !== 'post') continue
          const a = teams[0], b = teams[1]
          const ca = ourCode(a.team?.abbreviation), cb = ourCode(b.team?.abbreviation)
          const scoreByCode: Record<string, number> = { [ca]: Number(a.score), [cb]: Number(b.score) }
          const cands = index.get([ca, cb].sort().join('|'))
          if (!cands || cands.length === 0) continue
          let spiel = cands[0]
          if (cands.length > 1) {
            const evT = new Date(e.date).getTime()
            spiel = cands.reduce((best, c) => Math.abs(new Date(c.anstoss).getTime() - evT) < Math.abs(new Date(best.anstoss).getTime() - evT) ? c : best, cands[0])
          }
          const toreH = scoreByCode[spiel.heim?.kuerzel], toreG = scoreByCode[spiel.gast?.kuerzel]
          if (toreH == null || toreG == null || Number.isNaN(toreH) || Number.isNaN(toreG)) continue
          if (spiel.tore_heim === toreH && spiel.tore_gast === toreG && spiel.ist_beendet === istBeendet && (spiel.live_minute ?? null) === (liveMin ?? null)) {
            if (state === 'in') espnLive++
            continue
          }
          const { error: updErr } = await db.from('spiel')
            .update({ tore_heim: toreH, tore_gast: toreG, ist_beendet: istBeendet, live_minute: liveMin })
            .eq('id', spiel.id)
          if (!updErr) { espnAktualisiert++; if (state === 'in') espnLive++ }
        } else {
          // --- K.o.-Phase: Spiel komplett aus ESPN pflegen (eigener Schlüssel) ---
          const home = teams.find((t: any) => t.homeAway === 'home') ?? teams[0]
          const away = teams.find((t: any) => t.homeAway === 'away') ?? teams[1]
          const heimId = kuerzelToId.get(ourCode(home.team?.abbreviation)) ?? null
          const gastId = kuerzelToId.get(ourCode(away.team?.abbreviation)) ?? null
          // Elfmeterschießen (falls ESPN es liefert): Sieger = höherer shootoutScore
          let elfmeter: 'heim' | 'gast' | null = null
          const hs = home.shootoutScore, as = away.shootoutScore
          if (istBeendet && hs != null && as != null && Number(hs) !== Number(as)) {
            elfmeter = Number(hs) > Number(as) ? 'heim' : 'gast'
          }
          koRows.push({
            espn_event_id: Number(e.id),
            heim_id: heimId, gast_id: gastId,
            anstoss: e.date, phase: 'ko',
            tore_heim: state === 'pre' ? null : Number(home.score),
            tore_gast: state === 'pre' ? null : Number(away.score),
            elfmeter_sieger: elfmeter, ist_beendet: istBeendet, live_minute: liveMin,
          })
          if (heimId && gastId) koMitTeams++
          if (state === 'in') espnLive++
        }
      }

      if (koRows.length > 0) {
        const { error: koErr } = await db.from('spiel').upsert(koRows, { onConflict: 'espn_event_id' })
        if (!koErr) koGepflegt = koRows.length
      }
    } catch (_) { /* ESPN-Overlay optional; OpenLigaDB-Daten bleiben gültig */ }

    return json({ ok: true, gesamt: matches.length, neu, aktualisiert, espnAktualisiert, espnLive, koGepflegt, koMitTeams })
  } catch (e) {
    return json({ error: `Serverfehler: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
