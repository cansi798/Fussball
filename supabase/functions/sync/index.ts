// Sync: holt Spielplan & Ergebnisse aus zwei Quellen.
//   1) OpenLigaDB (kostenlos, ohne Schlüssel) = Basis: Mannschaften, Spielplan,
//      Phase. Liefert auch Ergebnisse, hinkt aber bei Live/Endstand oft nach.
//   2) ESPN (kostenlos, ohne Schlüssel) = Echtzeit-Overlay: aktualisiert Score,
//      ist_beendet und Live-Minute für laufende/kürzlich beendete Spiele.
// Ergebnis-Updates lösen die Punkte-Neuberechnung per DB-Trigger aus.
// tv_sender bleibt bei Updates unangetastet (manuelle ARD/ZDF-Korrekturen).
import { serviceClient } from '../_shared/db.ts'
import { json, handleOptions } from '../_shared/cors.ts'

const KO_WORTE = ['achtel', 'viertel', 'halbfinale', 'finale', 'platz 3', 'sechzehntel']

function istKo(groupName?: string): boolean {
  const g = (groupName ?? '').toLowerCase()
  return KO_WORTE.some((w) => g.includes(w))
}

// ESPN nutzt FIFA/Englisch-Codes, OpenLigaDB teils eigene. Alias ESPN -> unser Kürzel.
const ESPN_ALIAS: Record<string, string> = {
  BIH: 'BHG', HAI: 'HTI', QAT: 'KAT', NED: 'NLD', KSA: 'SAR',
}
function ourCode(abbr?: string): string {
  const u = (abbr ?? '').toUpperCase()
  return ESPN_ALIAS[u] ?? u
}

interface OlResult {
  pointsTeam1: number
  pointsTeam2: number
  resultName?: string
  resultOrderID?: number
}

// Wählt aus den OpenLigaDB-Ergebnissen den maßgeblichen Endstand (nach Verl.)
// und erkennt eine Elfmeter-Entscheidung, falls vorhanden.
function ergebnisAuswerten(results: OlResult[]): {
  toreH: number | null; toreG: number | null; elfmeter: 'heim' | 'gast' | null
} {
  if (!results || results.length === 0) return { toreH: null, toreG: null, elfmeter: null }
  const sorted = [...results].sort((a, b) => (a.resultOrderID ?? 0) - (b.resultOrderID ?? 0))
  const elf = sorted.find((r) => (r.resultName ?? '').toLowerCase().includes('elfmeter'))
  const verl = sorted.find((r) => (r.resultName ?? '').toLowerCase().includes('verläng'))
  const regulaer = verl ?? [...sorted].reverse().find((r) => r !== elf) ?? sorted[sorted.length - 1]
  let elfmeter: 'heim' | 'gast' | null = null
  if (elf) elfmeter = elf.pointsTeam1 > elf.pointsTeam2 ? 'heim' : 'gast'
  return { toreH: regulaer.pointsTeam1, toreG: regulaer.pointsTeam2, elfmeter }
}

// YYYYMMDD (UTC) für die ESPN-Scoreboard-Abfrage.
function ymdUTC(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

// Holt ESPN-Events für ein Datumsfenster (gestern/heute/morgen UTC).
async function espnEvents(): Promise<any[]> {
  const now = new Date()
  const tage = [-1, 0, 1].map((off) => ymdUTC(new Date(now.getTime() + off * 86_400_000)))
  const alle: any[] = []
  for (const t of tage) {
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${t}`)
      if (!r.ok) continue
      const j = await r.json()
      for (const e of (j.events ?? [])) alle.push(e)
    } catch (_) { /* einzelner Tag darf den Sync nicht abbrechen */ }
  }
  return alle
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = await req.json().catch(() => ({}))
    const liga = /^[a-zA-Z0-9_]{1,40}$/.test(body.liga ?? '') ? body.liga : 'wm2026'
    const saison = /^\d{4}$/.test(body.saison ?? '') ? body.saison : '2026'
    const db = serviceClient()

    // =================== 1) OpenLigaDB: Basis ===================
    const res = await fetch(`https://api.openligadb.de/getmatchdata/${liga}/${saison}`)
    if (!res.ok) return json({ error: `OpenLigaDB antwortet mit ${res.status}` }, 502)
    const matches = (await res.json()) as any[]
    if (!Array.isArray(matches)) return json({ error: 'OpenLigaDB lieferte kein gültiges Format' }, 502)

    // Teams in EINEM Batch upserten
    const uniqueTeams = new Map<number, any>()
    for (const m of matches) for (const t of [m.team1, m.team2]) {
      if (t?.teamId && !uniqueTeams.has(t.teamId)) uniqueTeams.set(t.teamId, t)
    }
    const teamMap = new Map<number, string>()
    if (uniqueTeams.size > 0) {
      const { data: teamRows, error: teamErr } = await db.from('mannschaft').upsert(
        [...uniqueTeams.values()].map((t) => ({
          openliga_team_id: t.teamId, name: t.teamName,
          kuerzel: t.shortName ?? null, flagge_url: t.teamIconUrl ?? null,
        })),
        { onConflict: 'openliga_team_id' },
      ).select('id, openliga_team_id')
      if (teamErr) return json({ error: `Teams speichern fehlgeschlagen: ${teamErr.message}` }, 500)
      for (const r of teamRows ?? []) teamMap.set(r.openliga_team_id as number, r.id as string)
    }

    const { data: existingRows } = await db.from('spiel').select('openliga_match_id')
    const existing = new Set((existingRows ?? []).map((r: any) => r.openliga_match_id))

    const rows: Record<string, unknown>[] = []
    for (const m of matches) {
      const anstoss = m.matchDateTimeUTC ?? m.matchDateTime
      if (!anstoss || m.matchID == null) continue
      const { toreH, toreG, elfmeter } = ergebnisAuswerten(m.matchResults ?? [])
      rows.push({
        openliga_match_id: m.matchID,
        heim_id: teamMap.get(m.team1?.teamId) ?? null,
        gast_id: teamMap.get(m.team2?.teamId) ?? null,
        anstoss, phase: istKo(m.group?.groupName) ? 'ko' : 'gruppe',
        tore_heim: toreH, tore_gast: toreG, elfmeter_sieger: elfmeter,
        ist_beendet: !!m.matchIsFinished,
      })
    }
    let neu = 0, aktualisiert = 0
    if (rows.length > 0) {
      const { error: spielErr } = await db.from('spiel').upsert(rows, { onConflict: 'openliga_match_id' })
      if (spielErr) return json({ error: `Spiele speichern fehlgeschlagen: ${spielErr.message}` }, 500)
      for (const r of rows) (existing.has(r.openliga_match_id) ? aktualisiert++ : neu++)
    }

    // =================== 2) ESPN: Echtzeit-Overlay ===================
    let espnAktualisiert = 0, espnLive = 0
    try {
      const events = await espnEvents()
      // Index unserer Spiele nach Team-Paar (sortierte Kürzel) – in der Gruppen-
      // phase eindeutig; bei Doppelpaarungen entscheidet später das Datum.
      const { data: unsere } = await db.from('spiel')
        .select('id, anstoss, tore_heim, tore_gast, ist_beendet, live_minute, heim:heim_id(kuerzel), gast:gast_id(kuerzel)')
      const index = new Map<string, any[]>()
      for (const s of (unsere ?? []) as any[]) {
        const hk = s.heim?.kuerzel, gk = s.gast?.kuerzel
        if (!hk || !gk) continue
        const key = [hk, gk].sort().join('|')
        if (!index.has(key)) index.set(key, [])
        index.get(key)!.push(s)
      }

      for (const e of events) {
        const comp = e.competitions?.[0]
        const teams = comp?.competitors ?? []
        if (teams.length !== 2) continue
        const state = e.status?.type?.state // 'pre' | 'in' | 'post'
        if (state !== 'in' && state !== 'post') continue // nur live/beendet überlagern

        const a = teams[0], b = teams[1]
        const ca = ourCode(a.team?.abbreviation), cb = ourCode(b.team?.abbreviation)
        const scoreByCode: Record<string, number> = {
          [ca]: Number(a.score), [cb]: Number(b.score),
        }
        const key = [ca, cb].sort().join('|')
        const cands = index.get(key)
        if (!cands || cands.length === 0) continue
        // Bei mehreren (Doppelpaarung) das zeitlich nächste Spiel nehmen.
        let spiel = cands[0]
        if (cands.length > 1) {
          const evT = new Date(e.date).getTime()
          spiel = cands.reduce((best, c) =>
            Math.abs(new Date(c.anstoss).getTime() - evT) < Math.abs(new Date(best.anstoss).getTime() - evT) ? c : best, cands[0])
        }

        const toreH = scoreByCode[spiel.heim?.kuerzel]
        const toreG = scoreByCode[spiel.gast?.kuerzel]
        if (toreH == null || toreG == null || Number.isNaN(toreH) || Number.isNaN(toreG)) continue

        const istBeendet = state === 'post'
        const halbzeit = (e.status?.type?.name ?? '').toUpperCase().includes('HALFTIME')
        const liveMin = state === 'in' ? (halbzeit ? 'HZ' : (e.status?.displayClock ?? null)) : null

        const unveraendert =
          spiel.tore_heim === toreH && spiel.tore_gast === toreG &&
          spiel.ist_beendet === istBeendet && (spiel.live_minute ?? null) === (liveMin ?? null)
        if (unveraendert) { if (state === 'in') espnLive++; continue }

        const { error: updErr } = await db.from('spiel')
          .update({ tore_heim: toreH, tore_gast: toreG, ist_beendet: istBeendet, live_minute: liveMin })
          .eq('id', spiel.id)
        if (!updErr) { espnAktualisiert++; if (state === 'in') espnLive++ }
      }
    } catch (_) { /* ESPN-Overlay ist optional; OpenLigaDB-Daten bleiben gültig */ }

    return json({ ok: true, gesamt: matches.length, neu, aktualisiert, espnAktualisiert, espnLive })
  } catch (e) {
    return json({ error: `Serverfehler: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
