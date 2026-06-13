import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiAdmin, apiSync } from '../lib/api'
import { Hinweis, Leer } from '../components/Ui'
import { formatDatum } from '../lib/format'
import type { Sieger, Spiel, Teilnehmer } from '../lib/types'

export function Admin() {
  const { session } = useAuth()
  const [reload, setReload] = useState(0)
  if (session?.rolle !== 'admin') return <Leer>Nur für Admins.</Leer>
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-pitch-700">🛠️ Admin</h1>
      <VereinAnlegen onCreated={() => setReload((r) => r + 1)} />
      <VereineUebersicht reload={reload} />
      <SyncBox />
      <PinReset />
      <ErgebnisPflege />
    </div>
  )
}

function VereinAnlegen({ onCreated }: { onCreated: () => void }) {
  const { session } = useAuth()
  const [name, setName] = useState('')
  const [kuerzel, setKuerzel] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    try {
      await apiAdmin('create_verein', { name, kuerzel, einladungscode: code }, session!.token)
      setMsg({ k: 'ok', t: `Verein "${name}" angelegt. Einladungscode: ${code.toUpperCase()}` })
      setName(''); setKuerzel(''); setCode('')
      onCreated()
    } catch (e) {
      setMsg({ k: 'error', t: e instanceof Error ? e.message : 'Fehler' })
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-extrabold text-pitch-700">Verein anlegen</h2>
      {msg && <Hinweis kind={msg.k}>{msg.t}</Hinweis>}
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Name (FC Beispiel)" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" placeholder="Kürzel (FCB)" value={kuerzel} onChange={(e) => setKuerzel(e.target.value)} required />
        <input className="input uppercase" placeholder="Code (FCB-2026)" value={code} onChange={(e) => setCode(e.target.value)} required />
        <button className="btn-primary sm:col-span-3">Anlegen</button>
      </form>
    </section>
  )
}

function VereineUebersicht({ reload }: { reload: number }) {
  const { supabase } = useAuth()
  const [vereine, setVereine] = useState<{ id: string; name: string; kuerzel: string }[]>([])
  const [mitglieder, setMitglieder] = useState<Teilnehmer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      setLoading(true)
      const [{ data: v }, { data: m }] = await Promise.all([
        supabase.from('verein').select('id, name, kuerzel').neq('kuerzel', 'ADMIN').order('name'),
        supabase.from('teilnehmer').select('id, vorname, nachname, rolle, haushalt, verein_id, geburtsjahr').neq('rolle', 'admin'),
      ])
      if (!aktiv) return
      setVereine((v as any) ?? [])
      setMitglieder((m as any) ?? [])
      setLoading(false)
    })()
    return () => { aktiv = false }
  }, [supabase, reload])

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-extrabold text-pitch-700">Angelegte Vereine & Teilnehmer</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Lädt …</p>
      ) : vereine.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Vereine angelegt.</p>
      ) : (
        <div className="space-y-3">
          {vereine.map((v) => {
            const leute = mitglieder.filter((m) => m.verein_id === v.id)
            const kinder = leute.filter((m) => m.rolle === 'kind')
            const eltern = leute.filter((m) => m.rolle === 'elternteil')
            return (
              <div key={v.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700">
                    {v.name} <span className="text-slate-400">({v.kuerzel})</span>
                  </span>
                  <span className="pill bg-pitch-100 text-pitch-700 whitespace-nowrap">
                    {eltern.length} Eltern · {kinder.length} Kinder
                  </span>
                </div>
                {leute.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-400">Noch niemand registriert.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {leute.map((m) => (
                      <li key={m.id} className={`pill text-xs ${m.rolle === 'kind' ? 'bg-sun-400/20 text-amber-800' : 'bg-white text-slate-600 ring-1 ring-black/10'}`}>
                        {m.rolle === 'kind' ? '🧒' : '👤'} {m.vorname}{m.nachname ? ` ${m.nachname}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function SyncBox() {
  const { session } = useAuth()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true); setMsg(null)
    try {
      const r: any = await apiSync(session!.token)
      setMsg(`OK · gesamt ${r.gesamt}, neu ${r.neu}, aktualisiert ${r.aktualisiert}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Fehler')
    } finally { setBusy(false) }
  }
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-extrabold text-pitch-700">Spieldaten synchronisieren</h2>
      <p className="text-sm text-slate-500">Holt Spielplan & Ergebnisse von OpenLigaDB (Liga wm2026).</p>
      {msg && <Hinweis kind="ok">{msg}</Hinweis>}
      <button className="btn-primary" onClick={go} disabled={busy}>{busy ? 'Läuft …' : '🔄 Jetzt synchronisieren'}</button>
    </section>
  )
}

function PinReset() {
  const { session } = useAuth()
  const [username, setUsername] = useState('')
  const [newPin, setNewPin] = useState('')
  const [msg, setMsg] = useState<{ k: 'ok' | 'error'; t: string } | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null)
    try {
      await apiAdmin('reset_pin', { username, newPin }, session!.token)
      setMsg({ k: 'ok', t: `PIN für "${username}" neu gesetzt.` })
      setUsername(''); setNewPin('')
    } catch (e) {
      setMsg({ k: 'error', t: e instanceof Error ? e.message : 'Fehler' })
    }
  }
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-extrabold text-pitch-700">PIN zurücksetzen</h2>
      {msg && <Hinweis kind={msg.k}>{msg.t}</Hinweis>}
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <input className="input sm:col-span-1" placeholder="Benutzername" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="input sm:col-span-1" placeholder="Neue PIN" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} required />
        <button className="btn-ghost sm:col-span-1">Setzen</button>
      </form>
    </section>
  )
}

function ErgebnisPflege() {
  const { supabase } = useAuth()
  const [spiele, setSpiele] = useState<Spiel[]>([])
  const [suche, setSuche] = useState('')

  async function lade() {
    const { data } = await supabase.from('spiel').select('*, heim:heim_id(*), gast:gast_id(*)').order('anstoss')
    setSpiele((data as any) ?? [])
  }
  useEffect(() => { lade() }, [supabase])

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase()
    if (!q) return spiele.slice(0, 40)
    return spiele.filter((s) =>
      (s.heim?.name ?? '').toLowerCase().includes(q) || (s.gast?.name ?? '').toLowerCase().includes(q),
    )
  }, [spiele, suche])

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-extrabold text-pitch-700">Ergebnisse & TV-Sender pflegen</h2>
      <input className="input" placeholder="🔍 Spiel suchen (Teamname) …" value={suche} onChange={(e) => setSuche(e.target.value)} />
      <div className="divide-y divide-slate-100">
        {gefiltert.map((s) => <ErgebnisZeile key={s.id} spiel={s} onSaved={lade} />)}
        {gefiltert.length === 0 && <p className="py-4 text-sm text-slate-400">Keine Spiele.</p>}
      </div>
    </section>
  )
}

function ErgebnisZeile({ spiel, onSaved }: { spiel: Spiel; onSaved: () => void }) {
  const { supabase } = useAuth()
  const [h, setH] = useState(spiel.tore_heim?.toString() ?? '')
  const [g, setG] = useState(spiel.tore_gast?.toString() ?? '')
  const [elf, setElf] = useState<string>(spiel.elfmeter_sieger ?? '')
  const [sender, setSender] = useState(spiel.tv_sender ?? '')
  const [beendet, setBeendet] = useState(spiel.ist_beendet)
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  async function save() {
    const { error } = await supabase.from('spiel').update({
      tore_heim: h === '' ? null : Number(h),
      tore_gast: g === '' ? null : Number(g),
      elfmeter_sieger: (elf || null) as Sieger | null,
      tv_sender: sender || null,
      ist_beendet: beendet,
    }).eq('id', spiel.id)
    setStatus(error ? 'err' : 'ok')
    if (!error) { onSaved(); setTimeout(() => setStatus('idle'), 1200) }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 text-sm">
      <div className="w-full text-xs font-bold text-slate-400 sm:w-40">{formatDatum(spiel.anstoss)}{spiel.phase === 'ko' ? ' · K.o.' : ''}</div>
      <span className="min-w-0 flex-1 truncate font-bold text-slate-600">{spiel.heim?.name ?? '?'}</span>
      <input className="w-10 rounded-lg border-2 border-slate-200 py-1 text-center font-bold" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, '').slice(0, 2))} />
      <span>:</span>
      <input className="w-10 rounded-lg border-2 border-slate-200 py-1 text-center font-bold" value={g} onChange={(e) => setG(e.target.value.replace(/\D/g, '').slice(0, 2))} />
      <span className="min-w-0 flex-1 truncate text-right font-bold text-slate-600">{spiel.gast?.name ?? '?'}</span>
      <select className="rounded-lg border-2 border-slate-200 py-1 text-xs" value={elf} onChange={(e) => setElf(e.target.value)} title="Elfmeter-Sieger">
        <option value="">– kein Elfm. –</option>
        <option value="heim">Elfm.: Heim</option>
        <option value="gast">Elfm.: Gast</option>
      </select>
      <input className="w-28 rounded-lg border-2 border-slate-200 px-2 py-1 text-xs" placeholder="TV-Sender" value={sender} onChange={(e) => setSender(e.target.value)} />
      <label className="flex items-center gap-1 text-xs font-bold text-slate-500">
        <input type="checkbox" checked={beendet} onChange={(e) => setBeendet(e.target.checked)} /> fertig
      </label>
      <button className="btn-primary px-3 py-1 text-xs" onClick={save}>Speichern</button>
      {status === 'ok' && <span className="text-emerald-600">✓</span>}
      {status === 'err' && <span className="text-red-600">Fehler</span>}
    </div>
  )
}
