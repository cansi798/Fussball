// Sync: holt Spielplan & Ergebnisse von OpenLigaDB (kostenlos, ohne Schlüssel)
// und schreibt Mannschaften + Spiele. Ergebnis-Updates lösen die Punkte-
// Neuberechnung per DB-Trigger aus. tv_sender bleibt bei Updates unangetastet
// (damit manuelle ARD/ZDF-Korrekturen erhalten bleiben).
//
// Robust per BATCH: ein Upsert für alle Teams, ein Upsert für alle Spiele –
// statt >200 sequenzieller Einzel-Calls. Das verhindert Teilausfälle/Timeouts,
// bei denen früher nicht alle Spiele aktualisiert wurden.
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
    if (!Array.isArray(matches)) return json({ error: 'OpenLigaDB lieferte kein gültiges Format' }, 502)

    // ---------- 1. Alle Mannschaften in EINEM Batch upserten ----------
    const uniqueTeams = new Map<number, any>()
    for (const m of matches) {
      for (const t of [m.team1, m.team2]) {
        if (t?.teamId && !uniqueTeams.has(t.teamId)) uniqueTeams.set(t.teamId, t)
      }
    }
    const teamMap = new Map<number, string>() // openliga_team_id -> uuid
    if (uniqueTeams.size > 0) {
      const { data: teamRows, error: teamErr } = await db.from('mannschaft').upsert(
        [...uniqueTeams.values()].map((t) => ({
          openliga_team_id: t.teamId,
          name: t.teamName,
          kuerzel: t.shortName ?? null,
          flagge_url: t.teamIconUrl ?? null,
        })),
        { onConflict: 'openliga_team_id' },
      ).select('id, openliga_team_id')
      if (teamErr) return json({ error: `Teams speichern fehlgeschlagen: ${teamErr.message}` }, 500)
      for (const r of teamRows ?? []) teamMap.set(r.openliga_team_id as number, r.id as string)
    }

    // ---------- 2. Bestehende Spiel-IDs für die neu/aktualisiert-Zählung ----------
    const { data: existingRows } = await db.from('spiel').select('openliga_match_id')
    const existing = new Set((existingRows ?? []).map((r: any) => r.openliga_match_id))

    // ---------- 3. Alle Spiel-Zeilen bauen (tv_sender bewusst weggelassen) ----------
    const rows: Record<string, unknown>[] = []
    for (const m of matches) {
      const anstoss = m.matchDateTimeUTC ?? m.matchDateTime
      if (!anstoss || m.matchID == null) continue
      const { toreH, toreG, elfmeter } = ergebnisAuswerten(m.matchResults ?? [])
      rows.push({
        openliga_match_id: m.matchID,
        heim_id: teamMap.get(m.team1?.teamId) ?? null,
        gast_id: teamMap.get(m.team2?.teamId) ?? null,
        anstoss,
        phase: istKo(m.group?.groupName) ? 'ko' : 'gruppe',
        tore_heim: toreH,
        tore_gast: toreG,
        elfmeter_sieger: elfmeter,
        ist_beendet: !!m.matchIsFinished,
      })
    }

    // ---------- 4. Alle Spiele in EINEM Batch upserten ----------
    let neu = 0, aktualisiert = 0
    if (rows.length > 0) {
      const { error: spielErr } = await db.from('spiel').upsert(rows, { onConflict: 'openliga_match_id' })
      if (spielErr) return json({ error: `Spiele speichern fehlgeschlagen: ${spielErr.message}` }, 500)
      for (const r of rows) (existing.has(r.openliga_match_id) ? aktualisiert++ : neu++)
    }

    return json({ ok: true, gesamt: matches.length, neu, aktualisiert })
  } catch (e) {
    return json({ error: `Serverfehler: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
