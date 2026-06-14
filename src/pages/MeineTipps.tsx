import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFamilie } from '../hooks/useFamilie'
import { Team } from '../components/Team'
import { Spinner, Hinweis, Leer, SegmentSwitch } from '../components/Ui'
import { formatDatum, spielStatus } from '../lib/format'
import { tippAufschluesselung } from '../lib/scoring'
import type { Spiel, Tipp } from '../lib/types'

export function MeineTipps() {
  const { supabase, session, dataVersion } = useAuth()
  const { players } = useFamilie()
  const [alsId, setAlsId] = useState<string>('')
  const [spiele, setSpiele] = useState<Spiel[]>([])
  const [tipps, setTipps] = useState<Record<string, Tipp>>({})
  const [loading, setLoading] = useState(true)

  // Standard-Spieler = man selbst
  useEffect(() => {
    if (!alsId && session) setAlsId(session.teilnehmer_id)
  }, [session, alsId])

  // Beendete Spiele laden (neueste zuerst)
  useEffect(() => {
    let aktiv = true
    ;(async () => {
      setLoading(true)
      // Alle Spiele mit Ergebnis laden (nicht strikt ist_beendet, da das
      // OpenLigaDB-Flag nachhinken kann); laufende Spiele filtern wir unten raus.
      const { data } = await supabase
        .from('spiel')
        .select('*, heim:heim_id(*), gast:gast_id(*)')
        .not('tore_heim', 'is', null)
        .order('anstoss', { ascending: false })
      if (aktiv) { setSpiele((data as any) ?? []); setLoading(false) }
    })()
    return () => { aktiv = false }
  }, [supabase, dataVersion])

  // Tipps des gewählten Spielers laden
  useEffect(() => {
    if (!alsId) return
    let aktiv = true
    setTipps({})
    ;(async () => {
      const { data } = await supabase.from('tipp').select('*').eq('teilnehmer_id', alsId)
      if (!aktiv) return
      const map: Record<string, Tipp> = {}
      for (const t of (data as Tipp[]) ?? []) map[t.spiel_id] = t
      setTipps(map)
    })()
    return () => { aktiv = false }
  }, [alsId, supabase, dataVersion])

  // Nur beendete Spiele (kein laufendes) mit eigenem Tipp
  const bewertet = useMemo(
    () => spiele
      .filter((s) => tipps[s.id] && spielStatus(s) === 'beendet')
      .map((s) => ({ spiel: s, tipp: tipps[s.id] })),
    [spiele, tipps],
  )
  const gesamt = useMemo(() => bewertet.reduce((sum, b) => sum + (b.tipp.punkte ?? 0), 0), [bewertet])

  if (loading) return <Spinner label="Tipps werden geladen …" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-pitch-700">🎯 Meine Tipps</h1>
        {players.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500">Tipps von:</span>
            <SegmentSwitch
              value={alsId}
              onChange={setAlsId}
              options={players.map((p) => ({ value: p.id, label: p.vorname }))}
            />
          </div>
        )}
      </div>

      <Hinweis>
        Rückschau auf beendete Spiele: dein Tipp, das Ergebnis und die Punkte.
        Exakt = 3 · eine Torzahl = 2 · Tendenz = 1 · sonst 0.
        {bewertet.length > 0 && <> · <span className="font-extrabold">Gesamt: {gesamt} Pkt</span></>}
      </Hinweis>

      {bewertet.length === 0 ? (
        <Leer>Noch keine bewerteten Spiele – deine Tipps erscheinen hier, sobald Spiele beendet sind. ⚽</Leer>
      ) : (
        <div className="space-y-3">
          {bewertet.map(({ spiel, tipp }) => (
            <RueckschauKarte key={spiel.id} spiel={spiel} tipp={tipp} />
          ))}
        </div>
      )}
    </div>
  )
}

const GUETE_STYLE: Record<string, { label: string; pill: string; punkte: string }> = {
  exakt: { label: '✓✓ exakt', pill: 'bg-emerald-100 text-emerald-700', punkte: 'text-emerald-600' },
  teiltreffer: { label: '✓ eine Torzahl', pill: 'bg-amber-100 text-amber-700', punkte: 'text-amber-600' },
  tendenz: { label: '↗ Tendenz', pill: 'bg-sky-100 text-sky-700', punkte: 'text-sky-600' },
  daneben: { label: '✗ daneben', pill: 'bg-slate-100 text-slate-500', punkte: 'text-slate-400' },
  offen: { label: 'offen', pill: 'bg-slate-100 text-slate-500', punkte: 'text-slate-400' },
}

function RueckschauKarte({ spiel, tipp }: { spiel: Spiel; tipp: Tipp }) {
  const { guete, koBonus } = tippAufschluesselung(
    tipp.tipp_heim, tipp.tipp_gast, spiel.tore_heim, spiel.tore_gast, spiel.phase, spiel.elfmeter_sieger,
  )
  const stil = GUETE_STYLE[guete]

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>{formatDatum(spiel.anstoss)}</span>
        {spiel.phase === 'ko' && <span className="pill bg-amber-100 text-amber-700">K.o.</span>}
      </div>

      {/* Ergebnis */}
      <div className="flex items-center gap-2">
        <div className="flex-1"><Team team={spiel.heim} /></div>
        <div className="shrink-0 text-center">
          <span className="text-xl font-black text-pitch-700">{spiel.tore_heim}:{spiel.tore_gast}</span>
          {spiel.elfmeter_sieger && <span className="block text-[10px] font-bold text-amber-600">n. E.</span>}
        </div>
        <div className="flex-1"><Team team={spiel.gast} align="right" /></div>
      </div>

      {/* Tipp + Bewertung */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-slate-500">Dein Tipp:</span>
          <span className="font-extrabold text-slate-700">{tipp.tipp_heim}:{tipp.tipp_gast}</span>
          <span className={`pill text-[11px] ${stil.pill}`}>{stil.label}</span>
          {koBonus && <span className="pill bg-amber-100 text-amber-700 text-[11px]">+ Sieger-Bonus</span>}
        </div>
        <span className={`shrink-0 text-lg font-black ${stil.punkte}`}>
          {tipp.punkte > 0 ? `+${tipp.punkte}` : '0'}
        </span>
      </div>
    </div>
  )
}
