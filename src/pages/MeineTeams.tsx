import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Flagge, Team } from '../components/Team'
import { Spinner, Hinweis, Leer } from '../components/Ui'
import { formatDatum, formatZeit } from '../lib/format'
import type { Mannschaft, Spiel } from '../lib/types'

export function MeineTeams() {
  const { supabase, session } = useAuth()
  const [teams, setTeams] = useState<Mannschaft[]>([])
  const [spiele, setSpiele] = useState<Spiel[]>([])
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [suche, setSuche] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const tid = session!.teilnehmer_id

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      setLoading(true)
      const [{ data: m }, { data: v }, { data: s }] = await Promise.all([
        supabase.from('mannschaft').select('*').order('name'),
        supabase.from('verfolgt').select('mannschaft_id').eq('teilnehmer_id', tid),
        supabase.from('spiel').select('*, heim:heim_id(*), gast:gast_id(*)').gt('anstoss', new Date().toISOString()).order('anstoss'),
      ])
      if (!aktiv) return
      setTeams((m as Mannschaft[]) ?? [])
      setFollowed(new Set((v ?? []).map((r: any) => r.mannschaft_id)))
      setSpiele((s as any) ?? [])
      setLoading(false)
    })()
    return () => { aktiv = false }
  }, [supabase, tid])

  async function toggle(team: Mannschaft) {
    setMsg(null)
    if (followed.has(team.id)) {
      await supabase.from('verfolgt').delete().eq('teilnehmer_id', tid).eq('mannschaft_id', team.id)
      setFollowed((s) => { const n = new Set(s); n.delete(team.id); return n })
    } else {
      if (followed.size >= 3) { setMsg('Du kannst maximal 3 Mannschaften verfolgen.'); return }
      const { error } = await supabase.from('verfolgt').insert({ teilnehmer_id: tid, mannschaft_id: team.id })
      if (error) { setMsg(error.message); return }
      setFollowed((s) => new Set(s).add(team.id))
    }
  }

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams
  }, [teams, suche])

  const naechste = useMemo(
    () => spiele.filter((s) => (s.heim_id && followed.has(s.heim_id)) || (s.gast_id && followed.has(s.gast_id))).slice(0, 8),
    [spiele, followed],
  )

  if (loading) return <Spinner label="Mannschaften werden geladen …" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-pitch-700">⭐ Meine Teams</h1>
        <span className="pill bg-pitch-100 text-pitch-700">{followed.size}/3</span>
      </div>

      {msg && <Hinweis kind="error">{msg}</Hinweis>}

      {naechste.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-extrabold uppercase tracking-wide text-slate-400">Nächste Spiele deiner Teams</h2>
          <div className="card divide-y divide-slate-100">
            {naechste.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-28 shrink-0 text-xs font-bold text-slate-400">
                  {formatDatum(s.anstoss)}<br />{formatZeit(s.anstoss)}
                </div>
                <div className="flex-1"><Team team={s.heim} /></div>
                <span className="font-black text-slate-300">:</span>
                <div className="flex-1"><Team team={s.gast} align="right" /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <input className="input" placeholder="🔍 Mannschaft suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />

      {teams.length === 0 ? (
        <Leer>Noch keine Mannschaften geladen. Schau später wieder vorbei.</Leer>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {gefiltert.map((t) => {
            const an = followed.has(t.id)
            return (
              <button
                key={t.id}
                onClick={() => toggle(t)}
                className={`flex items-center gap-2 rounded-2xl p-3 text-left ring-2 transition ${
                  an ? 'bg-sun-400/20 ring-sun-400' : 'bg-white ring-transparent hover:ring-pitch-200'
                }`}
              >
                <Flagge team={t} />
                <span className="flex-1 truncate font-bold text-slate-700">{t.name}</span>
                <span>{an ? '⭐' : '＋'}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
