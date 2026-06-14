import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFamilie } from '../hooks/useFamilie'
import { Team } from '../components/Team'
import { SenderBadge } from '../components/SenderBadge'
import { Spinner, Leer, Hinweis } from '../components/Ui'
import { tagKey, tagLabel, formatZeit, spielStatus } from '../lib/format'
import type { Spiel } from '../lib/types'

export function Spielplan() {
  const { supabase, refreshData, syncing, dataVersion } = useAuth()
  const { players } = useFamilie()
  const [spiele, setSpiele] = useState<Spiel[]>([])
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [nurMeine, setNurMeine] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  async function ladeSpiele() {
    const { data } = await supabase
      .from('spiel')
      .select('*, heim:heim_id(*), gast:gast_id(*)')
      .order('anstoss')
    setSpiele((data as any) ?? [])
  }

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      setLoading(true)
      await ladeSpiele()
      if (aktiv) setLoading(false)
    })()
    return () => { aktiv = false }
  }, [supabase, dataVersion])

  // Verfolgte Teams der Familie für den Filter laden
  useEffect(() => {
    if (players.length === 0) return
    ;(async () => {
      const ids = players.map((p) => p.id)
      const { data } = await supabase.from('verfolgt').select('mannschaft_id').in('teilnehmer_id', ids)
      setFollowed(new Set((data ?? []).map((r: any) => r.mannschaft_id)))
    })()
  }, [players, supabase])

  async function sync() {
    setMsg(null)
    await refreshData() // synct + lädt via dataVersion-Effekt neu
    setMsg('Spielplan aktualisiert')
  }

  const gefiltert = useMemo(() => {
    if (!nurMeine) return spiele
    return spiele.filter((s) =>
      (s.heim_id && followed.has(s.heim_id)) || (s.gast_id && followed.has(s.gast_id)),
    )
  }, [spiele, nurMeine, followed])

  const tage = useMemo(() => {
    const map = new Map<string, Spiel[]>()
    for (const s of gefiltert) {
      const k = tagKey(s.anstoss)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(s)
    }
    return [...map.entries()]
  }, [gefiltert])

  if (loading) return <Spinner label="Spielplan wird geladen …" />

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-pitch-700">📅 Spielplan</h1>
        <div className="flex items-center gap-2">
          {followed.size > 0 && (
            <button
              onClick={() => setNurMeine((v) => !v)}
              className={`pill ring-1 ${nurMeine ? 'bg-sun-400 text-amber-900 ring-amber-300' : 'bg-white text-slate-600 ring-black/10'}`}
            >
              ⭐ Nur meine Teams
            </button>
          )}
          <button className="btn-ghost px-3 py-2 text-sm" onClick={sync} disabled={syncing}>
            {syncing ? 'Aktualisiere …' : '🔄 Aktualisieren'}
          </button>
        </div>
      </div>

      {msg && <Hinweis kind="ok">{msg}</Hinweis>}

      {tage.length === 0 ? (
        <Leer>Noch keine Spiele vorhanden. Tippe auf „Aktualisieren", um den Spielplan zu laden.</Leer>
      ) : (
        tage.map(([key, liste]) => (
          <section key={key} className="space-y-2">
            <h2 className="px-1 text-sm font-extrabold uppercase tracking-wide text-slate-400">
              {tagLabel(liste[0].anstoss)}
            </h2>
            <div className="card divide-y divide-slate-100">
              {liste.map((s) => <SpielplanZeile key={s.id} spiel={s} />)}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function SpielplanZeile({ spiel }: { spiel: Spiel }) {
  const status = spielStatus(spiel)
  const hatErgebnis = spiel.tore_heim !== null
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-14 shrink-0 text-center">
        {status === 'live' ? (
          <span className="pill bg-red-100 text-red-600 text-[11px] animate-pulse">
            {spiel.live_minute ? `⏱ ${spiel.live_minute}` : 'live'}
          </span>
        ) : status === 'beendet' ? (
          <span className="block text-xs font-bold text-slate-400">{hatErgebnis ? 'Endstand' : 'beendet'}</span>
        ) : (
          <span className="block text-sm font-bold text-slate-500">{formatZeit(spiel.anstoss).replace(' Uhr', '')}</span>
        )}
      </div>
      <div className="flex-1"><Team team={spiel.heim} /></div>
      <div className="w-16 shrink-0 text-center">
        {hatErgebnis && status !== 'kommend' ? (
          <span className="text-lg font-black text-pitch-700">{spiel.tore_heim}:{spiel.tore_gast}</span>
        ) : (
          <span className="text-slate-300 font-black">–:–</span>
        )}
        {spiel.elfmeter_sieger && <span className="block text-[10px] font-bold text-amber-600">n. E.</span>}
      </div>
      <div className="flex-1"><Team team={spiel.gast} align="right" /></div>
      <div className="hidden w-24 shrink-0 justify-end sm:flex"><SenderBadge sender={spiel.tv_sender} /></div>
    </div>
  )
}
