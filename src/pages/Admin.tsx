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
      <ErgebnisPflege />
    </div>
  )
}

function VereinAnlegen({ onCreated }: { onCreated: () => void }) {
  const { session } = useAuth()
  const [name, setName] = useState('')
  const [kuerzel, setKuerzel] = useState('')
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setFehler(null)
    try {
      await apiAdmin('create_verein', { name, kuerzel, einladungscode: code }, session!.token)
      setCreated({ name, code: code.trim().toUpperCase() })
      setCopied(false)
      setName(''); setKuerzel(''); setCode('')
      onCreated()
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Fehler')
    }
  }

  const shareText = created
    ? `⚽ WM 2026 Tippspiel – ${created.name}\n\nMach mit beim Tippspiel! So geht's:\n1. Seite öffnen: https://cansi798.github.io/Fussball/#/registrieren\n2. Einladungscode eingeben: ${created.code}\n3. Benutzername + PIN wählen, Kinder hinzufügen – fertig!\n\nViel Spaß beim Tippen! 🏆`
    : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Kopieren nicht möglich – bitte Text manuell markieren.')
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-extrabold text-pitch-700">Verein anlegen</h2>
      {fehler && <Hinweis kind="error">{fehler}</Hinweis>}
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <input className="input" placeholder="Name (FC Beispiel)" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" placeholder="Kürzel (FCB)" value={kuerzel} onChange={(e) => setKuerzel(e.target.value)} required />
        <input className="input uppercase" placeholder="Code (FCB-2026)" value={code} onChange={(e) => setCode(e.target.value)} required />
        <button className="btn-primary sm:col-span-3">Anlegen</button>
      </form>

      {created && (
        <div className="space-y-2 rounded-2xl bg-pitch-50 p-4 ring-1 ring-pitch-100">
          <p className="font-bold text-pitch-700">✅ „{created.name}" angelegt – Einladung teilen:</p>
          <textarea
            readOnly
            value={shareText}
            rows={8}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-xl border-2 border-pitch-100 bg-white p-3 text-sm text-slate-700"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="btn-primary px-4 py-2 text-sm">{copied ? '✓ Kopiert!' : '📋 Text kopieren'}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="btn-ghost px-4 py-2 text-sm">WhatsApp teilen</a>
          </div>
          <p className="text-xs text-slate-400">Hinweis: Den Code siehst du nur jetzt – danach ist er verschlüsselt gespeichert.</p>
        </div>
      )}
    </section>
  )
}

function einladungsText(name: string, code: string) {
  return `⚽ WM 2026 Tippspiel – ${name}\n\nMach mit beim Tippspiel! So geht's:\n1. Seite öffnen: https://cansi798.github.io/Fussball/#/registrieren\n2. Einladungscode eingeben: ${code}\n3. Benutzername + PIN wählen, Kinder hinzufügen – fertig!\n\nViel Spaß beim Tippen! 🏆`
}

function VereinCodeShare({ verein, onChanged }: { verein: { id: string; name: string; einladungscode: string | null }; onChanged: () => void }) {
  const { session } = useAuth()
  const [copied, setCopied] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [saving, setSaving] = useState(false)
  const code = verein.einladungscode
  const text = code ? einladungsText(verein.name, code) : ''

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { alert('Kopieren nicht möglich – bitte Text manuell markieren.') }
  }
  async function speichern(e: React.FormEvent) {
    e.preventDefault()
    if (!codeInput.trim()) return
    setSaving(true)
    try { await apiAdmin('set_code', { verein_id: verein.id, einladungscode: codeInput.trim() }, session!.token); onChanged() }
    catch (err) { alert(err instanceof Error ? err.message : 'Fehler') }
    finally { setSaving(false) }
  }

  if (!code) {
    return (
      <form onSubmit={speichern} className="mt-2 flex items-center gap-2">
        <input className="input max-w-[11rem] py-1.5 text-sm uppercase" placeholder="Einladungscode festlegen" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} />
        <button className="btn-ghost px-3 py-1.5 text-xs" disabled={saving}>Speichern & teilen</button>
      </form>
    )
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="pill bg-slate-100 font-mono text-slate-600">{code}</span>
      <button onClick={copy} className="btn-ghost px-3 py-1.5 text-xs">{copied ? '✓ Kopiert' : '📋 Einladung teilen'}</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5 text-xs">WhatsApp</a>
    </div>
  )
}

function VereineUebersicht({ reload }: { reload: number }) {
  const { supabase, session } = useAuth()
  const [vereine, setVereine] = useState<{ id: string; name: string; kuerzel: string; einladungscode: string | null }[]>([])
  const [mitglieder, setMitglieder] = useState<Teilnehmer[]>([])
  const [logins, setLogins] = useState<Record<string, string>>({}) // teilnehmer_id -> username
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function lade() {
    const [{ data: v }, { data: m }, { data: b }] = await Promise.all([
      supabase.from('verein').select('id, name, kuerzel, einladungscode').neq('kuerzel', 'ADMIN').order('name'),
      supabase.from('teilnehmer').select('id, vorname, nachname, rolle, haushalt, verein_id, geburtsjahr').neq('rolle', 'admin'),
      supabase.from('benutzer').select('username, teilnehmer_id'),
    ])
    setVereine((v as any) ?? [])
    setMitglieder((m as any) ?? [])
    const map: Record<string, string> = {}
    for (const u of (b as any[]) ?? []) map[u.teilnehmer_id] = u.username
    setLogins(map)
  }

  useEffect(() => {
    let aktiv = true
    ;(async () => { setLoading(true); await lade(); if (aktiv) setLoading(false) })()
    return () => { aktiv = false }
  }, [supabase, reload])

  async function loeschen(m: Teilnehmer) {
    if (!confirm(`„${m.vorname}" wirklich löschen? Alle Tipps dieser Person gehen verloren.`)) return
    setBusy(m.id)
    const { error } = await supabase.from('teilnehmer').delete().eq('id', m.id)
    setBusy(null)
    if (error) alert('Fehler: ' + error.message)
    else lade()
  }

  async function vereinLoeschen(v: { id: string; name: string }) {
    if (!confirm(`Verein „${v.name}" mit ALLEN Teilnehmern und Tipps löschen? Das kann nicht rückgängig gemacht werden.`)) return
    setBusy(v.id)
    const { error } = await supabase.from('verein').delete().eq('id', v.id)
    setBusy(null)
    if (error) alert('Fehler: ' + error.message)
    else lade()
  }

  async function pinReset(username: string) {
    const neu = prompt(`Neue PIN für „${username}" (4–8 Ziffern):`)
    if (!neu) return
    try {
      await apiAdmin('reset_pin', { username, newPin: neu }, session!.token)
      alert('PIN wurde neu gesetzt.')
    } catch (e) {
      alert('Fehler: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-extrabold text-pitch-700">Vereine & Teilnehmer verwalten</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Lädt …</p>
      ) : vereine.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Vereine angelegt.</p>
      ) : (
        <div className="space-y-3">
          {vereine.map((v) => {
            const leute = mitglieder.filter((m) => m.verein_id === v.id)
            const eltern = leute.filter((m) => m.rolle === 'elternteil').length
            const kinder = leute.filter((m) => m.rolle === 'kind').length
            return (
              <div key={v.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700">{v.name} <span className="text-slate-400">({v.kuerzel})</span></span>
                  <div className="flex items-center gap-3">
                    <span className="pill bg-pitch-100 text-pitch-700 whitespace-nowrap">{eltern} E · {kinder} K</span>
                    <button onClick={() => vereinLoeschen(v)} disabled={busy === v.id} className="text-xs font-bold text-red-500 hover:underline">Verein löschen</button>
                  </div>
                </div>
                <VereinCodeShare verein={v} onChanged={lade} />
                {leute.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-400">Noch niemand registriert.</p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {leute.map((m) => {
                      const user = logins[m.id]
                      return (
                        <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                          <span className="min-w-0 truncate text-sm font-semibold text-slate-700">
                            {m.rolle === 'kind' ? '🧒' : '👤'} {m.vorname}{m.nachname ? ` ${m.nachname}` : ''}
                            {user
                              ? <span className="ml-2 text-xs text-slate-400">@{user}</span>
                              : <span className="ml-2 text-xs text-slate-300">(kein Login)</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            {user && <button onClick={() => pinReset(user)} className="text-xs font-bold text-pitch-600 hover:underline">PIN</button>}
                            <button onClick={() => loeschen(m)} disabled={busy === m.id} className="text-xs font-bold text-red-500 hover:underline">Löschen</button>
                          </span>
                        </li>
                      )
                    })}
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
