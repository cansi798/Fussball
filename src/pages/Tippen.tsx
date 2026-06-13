import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFamilie } from '../hooks/useFamilie'
import { Team } from '../components/Team'
import { SenderBadge } from '../components/SenderBadge'
import { Spinner, Hinweis, Leer, SegmentSwitch } from '../components/Ui'
import { formatDatum, formatZeit } from '../lib/format'
import type { Spiel, Tipp } from '../lib/types'

export function Tippen() {
  const { supabase, session } = useAuth()
  const { players } = useFamilie()
  const [alsId, setAlsId] = useState<string>('')
  const [spiele, setSpiele] = useState<Spiel[]>([])
  const [tipps, setTipps] = useState<Record<string, Tipp>>({})
  const [loading, setLoading] = useState(true)

  // Standard-Spieler = man selbst
  useEffect(() => {
    if (!alsId && session) setAlsId(session.teilnehmer_id)
  }, [session, alsId])

  // Kommende Spiele laden
  useEffect(() => {
    let aktiv = true
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('spiel')
        .select('*, heim:heim_id(*), gast:gast_id(*)')
        .gt('anstoss', new Date().toISOString())
        .order('anstoss')
        .limit(60)
      if (aktiv) { setSpiele((data as any) ?? []); setLoading(false) }
    })()
    return () => { aktiv = false }
  }, [supabase])

  // Tipps des gewählten Spielers laden
  useEffect(() => {
    if (!alsId) return
    let aktiv = true
    ;(async () => {
      const { data } = await supabase.from('tipp').select('*').eq('teilnehmer_id', alsId)
      if (!aktiv) return
      const map: Record<string, Tipp> = {}
      for (const t of (data as Tipp[]) ?? []) map[t.spiel_id] = t
      setTipps(map)
    })()
    return () => { aktiv = false }
  }, [alsId, supabase])

  async function speichern(spielId: string, h: number, g: number) {
    const { data, error } = await supabase.from('tipp').upsert(
      { teilnehmer_id: alsId, spiel_id: spielId, tipp_heim: h, tipp_gast: g },
      { onConflict: 'teilnehmer_id,spiel_id' },
    ).select('*').single()
    if (error) throw new Error(error.message)
    setTipps((m) => ({ ...m, [spielId]: data as Tipp }))
  }

  if (loading) return <Spinner label="Spiele werden geladen …" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-pitch-700">✍️ Tippen</h1>
        {players.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-500">Tippen als:</span>
            <SegmentSwitch
              value={alsId}
              onChange={setAlsId}
              options={players.map((p) => ({ value: p.id, label: p.vorname }))}
            />
          </div>
        )}
      </div>

      <Hinweis>Tippe vor Anpfiff – bis dahin beliebig änderbar. Exakt = 3 · eine Mannschaft = 1 · sonst 0.</Hinweis>

      {spiele.length === 0 ? (
        <Leer>Aktuell stehen keine kommenden Spiele zum Tippen an. 🎉</Leer>
      ) : (
        <div className="space-y-3">
          {spiele.map((s) => (
            <TippKarte key={s.id} spiel={s} tipp={tipps[s.id]} onSave={speichern} />
          ))}
        </div>
      )}
    </div>
  )
}

function TippKarte({
  spiel, tipp, onSave,
}: { spiel: Spiel; tipp?: Tipp; onSave: (id: string, h: number, g: number) => Promise<void> }) {
  const [h, setH] = useState(tipp ? String(tipp.tipp_heim) : '')
  const [g, setG] = useState(tipp ? String(tipp.tipp_gast) : '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    if (tipp) { setH(String(tipp.tipp_heim)); setG(String(tipp.tipp_gast)) }
  }, [tipp])

  const gueltig = /^\d{1,2}$/.test(h) && /^\d{1,2}$/.test(g)

  async function save() {
    if (!gueltig) return
    setStatus('saving'); setFehler('')
    try {
      await onSave(spiel.id, Number(h), Number(g))
      setStatus('ok')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (e) {
      setStatus('err')
      setFehler(e instanceof Error ? e.message : 'Fehler')
    }
  }

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400">
        <span>{formatDatum(spiel.anstoss)} · {formatZeit(spiel.anstoss)}</span>
        <div className="flex items-center gap-2">
          {spiel.phase === 'ko' && <span className="pill bg-amber-100 text-amber-700">K.o.</span>}
          <SenderBadge sender={spiel.tv_sender} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1"><Team team={spiel.heim} /></div>
        <input aria-label="Tore Heim" className="w-12 rounded-xl border-2 border-slate-200 py-2 text-center text-xl font-extrabold focus:border-pitch-500 outline-none"
          inputMode="numeric" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        <span className="font-black text-slate-400">:</span>
        <input aria-label="Tore Gast" className="w-12 rounded-xl border-2 border-slate-200 py-2 text-center text-xl font-extrabold focus:border-pitch-500 outline-none"
          inputMode="numeric" value={g} onChange={(e) => setG(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        <div className="flex-1"><Team team={spiel.gast} align="right" /></div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {status === 'ok' && <span className="text-sm font-bold text-emerald-600">✓ gespeichert</span>}
        {status === 'err' && <span className="text-sm font-bold text-red-600">{fehler}</span>}
        <button className="btn-primary px-4 py-2 text-sm" disabled={!gueltig || status === 'saving'} onClick={save}>
          {tipp ? 'Ändern' : 'Tippen'}
        </button>
      </div>
    </div>
  )
}
