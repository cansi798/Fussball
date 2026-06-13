// Sync: holt Spielplan & Ergebnisse von OpenLigaDB (kostenlos, ohne Schlüssel)
// und schreibt Mannschaften + Spiele. Ergebnis-Updates lösen die Punkte-
// Neuberechnung per DB-Trigger aus. tv_sender bleibt bei Updates unangetastet
// (damit manuelle ARD/ZDF-Korrekturen erhalten bleiben).
import { serviceClient } from '../_shared/db.ts'
import { json, handleOptions } from '../_shared/cors.ts'

const KO_WORTE = ['achtel', 'viertel', 'halbfinale', 'finale', 'platz 3', 'sechzehntel']

function istKo(groupName?: string): boolean {
  const g = (groupName ?? '').toLowerCase()
  return KO_WORTE.some((w) => g.includes(w))
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
  // Endstand = Verlängerung falls vorhanden, sonst letztes Nicht-Elfmeter-Ergebnis
  const regulaer = verl ?? [...sorted].reverse().find((r) => r !== elf) ?? sorted[sorted.length - 1]
  let elfmeter: 'heim' | 'gast' | null = null
  if (elf) elfmeter = elf.pointsTeam1 > elf.pointsTeam2 ? 'heim' : 'gast'
  return { toreH: regulaer.pointsTeam1, toreG: regulaer.pointsTeam2, elfmeter }
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = await req.json().catch(() => ({}))
    // Eingaben strikt validieren (verhindert Pfad-Injection in die OpenLigaDB-URL)
    const liga = /^[a-zA-Z0-9_]{1,40}$/.test(body.liga ?? '') ? body.liga : 'wm2026'
    const saison = /^\d{4}$/.test(body.saison ?? '') ? body.saison : '2026'
    const db = serviceClient()

    const res = await fetch(`https://api.openligadb.de/getmatchdata/${liga}/${saison}`)
    if (!res.ok) return json({ error: `OpenLigaDB antwortet mit ${res.status}` }, 502)
    const matches = (await res.json()) as any[]

    // Mannschafts-Cache (openliga_team_id -> uuid)
    const teamCache = new Map<number, string>()
    async function teamId(team: any): Promise<string | null> {
      if (!team?.teamId) return null
      if (teamCache.has(team.teamId)) return teamCache.get(team.teamId)!
      const { data } = await db.from('mannschaft').upsert({
        openliga_team_id: team.teamId,
        name: team.teamName,
        kuerzel: team.shortName ?? null,
        flagge_url: team.teamIconUrl ?? null,
      }, { onConflict: 'openliga_team_id' }).select('id').single()
      if (data) teamCache.set(team.teamId, data.id)
      return data?.id ?? null
    }

    let neu = 0, aktualisiert = 0
    for (const m of matches) {
      try {
        const heim = await teamId(m.team1)
        const gast = await teamId(m.team2)
        const anstoss = m.matchDateTimeUTC ?? m.matchDateTime
        if (!anstoss) continue
        const { toreH, toreG, elfmeter } = ergebnisAuswerten(m.matchResults ?? [])
        const phase = istKo(m.group?.groupName) ? 'ko' : 'gruppe'

        const { data: vorhanden } = await db.from('spiel')
          .select('id').eq('openliga_match_id', m.matchID).maybeSingle()

        const felder = {
          openliga_match_id: m.matchID,
          heim_id: heim, gast_id: gast,
          anstoss, phase,
          tore_heim: toreH, tore_gast: toreG,
          elfmeter_sieger: elfmeter,
          ist_beendet: !!m.matchIsFinished,
        }

        if (vorhanden) {
          await db.from('spiel').update(felder).eq('id', vorhanden.id) // tv_sender bleibt
          aktualisiert++
        } else {
          await db.from('spiel').insert(felder) // tv_sender -> Default 'MagentaTV'
          neu++
        }
      } catch (_) { /* ein fehlerhafter Datensatz darf den Sync nicht abbrechen */ }
    }

    return json({ ok: true, gesamt: matches.length, neu, aktualisiert })
  } catch (e) {
    return json({ error: `Serverfehler: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
