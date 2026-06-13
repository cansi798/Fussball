import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Hinweis } from '../components/Ui'
import type { KindForm } from '../lib/api'

interface KindRow extends KindForm { _id: number }

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [einladungscode, setCode] = useState('')
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [haushalt, setHaushalt] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [partnerOn, setPartnerOn] = useState(false)
  const [pLoginOn, setPLoginOn] = useState(false)
  const [pVorname, setPVorname] = useState('')
  const [pNachname, setPNachname] = useState('')
  const [pUsername, setPUsername] = useState('')
  const [pPin, setPPin] = useState('')
  const [kinder, setKinder] = useState<KindRow[]>([])
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function addKind() {
    setKinder((k) => [...k, { _id: Date.now() + Math.floor(performance.now()), vorname: '' }])
  }
  function updateKind(id: number, patch: Partial<KindRow>) {
    setKinder((k) => k.map((x) => (x._id === id ? { ...x, ...patch } : x)))
  }
  function removeKind(id: number) {
    setKinder((k) => k.filter((x) => x._id !== id))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null); setBusy(true)
    try {
      await register({
        einladungscode: einladungscode.trim(),
        username: username.trim(),
        pin: pin.trim(),
        vorname: vorname.trim(),
        nachname: nachname.trim() || undefined,
        haushalt: haushalt.trim(),
        partner: partnerOn && pVorname.trim()
          ? {
              vorname: pVorname.trim(),
              nachname: pNachname.trim() || undefined,
              username: pLoginOn && pUsername.trim() ? pUsername.trim() : undefined,
              pin: pLoginOn && pPin.trim() ? pPin.trim() : undefined,
            }
          : undefined,
        kinder: kinder.map(({ _id, ...rest }) => ({
          ...rest,
          vorname: rest.vorname.trim(),
          geburtsjahr: rest.geburtsjahr ? Number(rest.geburtsjahr) : undefined,
        })),
      })
      navigate('/tippen')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <div className="mb-5 text-center">
        <div className="text-5xl">📝</div>
        <h1 className="mt-1 text-2xl font-extrabold text-pitch-700">Registrieren</h1>
        <p className="text-slate-500 font-semibold">Mit Vereins-Einladungscode anmelden</p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {fehler && <Hinweis kind="error">{fehler}</Hinweis>}

        <section className="card space-y-4 p-5">
          <h2 className="font-extrabold text-pitch-700">1 · Vereins-Code</h2>
          <input className="input uppercase tracking-wider" placeholder="z. B. FCB-2026"
            value={einladungscode} onChange={(e) => setCode(e.target.value)} required />
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-extrabold text-pitch-700">2 · Dein Login (Elternteil)</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname *"><input className="input" value={vorname} onChange={(e) => setVorname(e.target.value)} required /></Field>
            <Field label="Nachname"><input className="input" value={nachname} onChange={(e) => setNachname(e.target.value)} placeholder="z. B. M." /></Field>
          </div>
          <Field label="Haushalt / Familie *" hint="Zweiter Elternteil gibt denselben Wert ein.">
            <input className="input" value={haushalt} onChange={(e) => setHaushalt(e.target.value)} placeholder="z. B. Familie Müller" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Benutzername *"><input className="input" value={username} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} required /></Field>
            <Field label="PIN * (4–8 Ziffern)"><input className="input tracking-widest" inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(e.target.value)} required /></Field>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <label className="flex items-center gap-2 font-extrabold text-pitch-700">
            <input type="checkbox" className="h-5 w-5 rounded" checked={partnerOn} onChange={(e) => setPartnerOn(e.target.checked)} />
            3 · Zweites Elternteil (Ehepartner) – optional
          </label>
          {partnerOn && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vorname *"><input className="input" value={pVorname} onChange={(e) => setPVorname(e.target.value)} /></Field>
                <Field label="Nachname"><input className="input" value={pNachname} onChange={(e) => setPNachname(e.target.value)} placeholder="z. B. M." /></Field>
              </div>
              <label className="flex items-center gap-2 font-semibold text-slate-600">
                <input type="checkbox" className="h-5 w-5 rounded" checked={pLoginOn} onChange={(e) => setPLoginOn(e.target.checked)} />
                Eigenes Login für den Ehepartner (optional)
              </label>
              {pLoginOn ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Benutzername *"><input className="input" autoCapitalize="none" value={pUsername} onChange={(e) => setPUsername(e.target.value)} /></Field>
                  <Field label="PIN * (4–8 Ziffern)"><input className="input tracking-widest" type="password" inputMode="numeric" value={pPin} onChange={(e) => setPPin(e.target.value)} /></Field>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Ohne eigenes Login wird der Ehepartner von dir mitverwaltet (du gibst seine Tipps mit ab). Mit eigenem Login meldet er sich selbst an und tippt unabhängig – dann kann niemand sonst seine Tipps ändern.</p>
              )}
            </div>
          )}
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-pitch-700">4 · Kinder</h2>
            <button type="button" className="btn-ghost text-sm" onClick={addKind}>+ Kind</button>
          </div>
          {kinder.length === 0 && <p className="text-sm text-slate-500 font-semibold">Noch keine Kinder hinzugefügt.</p>}
          {kinder.map((k) => (
            <div key={k._id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-black/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">Kind</span>
                <button type="button" className="text-sm font-bold text-red-500" onClick={() => removeKind(k._id)}>entfernen</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input className="input col-span-2" placeholder="Vorname *" value={k.vorname} onChange={(e) => updateKind(k._id, { vorname: e.target.value })} required />
                <input className="input" placeholder="Jahr" inputMode="numeric" value={k.geburtsjahr ?? ''} onChange={(e) => updateKind(k._id, { geburtsjahr: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <label className="flex items-center gap-2 font-semibold text-slate-600">
                <input type="checkbox" className="h-5 w-5 rounded" checked={!!k.eigenesLogin}
                  onChange={(e) => updateKind(k._id, { eigenesLogin: e.target.checked })} />
                Eigenes Login (für ältere Kinder)
              </label>
              {k.eigenesLogin && (
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Benutzername" autoCapitalize="none" value={k.username ?? ''} onChange={(e) => updateKind(k._id, { username: e.target.value })} />
                  <input className="input tracking-widest" type="password" inputMode="numeric" placeholder="PIN" value={k.pin ?? ''} onChange={(e) => updateKind(k._id, { pin: e.target.value })} />
                </div>
              )}
            </div>
          ))}
        </section>

        <button className="btn-primary w-full text-lg" disabled={busy}>
          {busy ? 'Wird angelegt …' : 'Registrieren & loslegen'}
        </button>
      </form>

      <p className="mt-5 text-center font-semibold text-slate-600">
        Schon ein Konto? <Link to="/login" className="text-pitch-600 underline">Einloggen</Link>
      </p>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-bold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}
