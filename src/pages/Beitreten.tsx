import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Hinweis } from '../components/Ui'

export function Beitreten() {
  const { joinVerein } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [mitKinder, setMitKinder] = useState(true)
  const [mitPartner, setMitPartner] = useState(true)
  const [mitTipps, setMitTipps] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setFehler(null); setBusy(true)
    try {
      await joinVerein(code.trim(), { mitKinder, mitPartner, mitTipps })
      navigate('/tippen')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-extrabold text-pitch-700">➕ Verein beitreten</h1>
      <form onSubmit={submit} className="card space-y-4 p-5">
        {fehler && <Hinweis kind="error">{fehler}</Hinweis>}
        <label className="block">
          <span className="mb-1 block font-bold text-slate-600">Einladungscode</span>
          <input className="input uppercase tracking-wider" placeholder="z. B. SVM-2026" value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <div className="space-y-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-black/5">
          <p className="font-bold text-slate-600">In den neuen Verein mitnehmen:</p>
          <label className="flex items-center gap-2 font-semibold text-slate-600"><input type="checkbox" className="h-5 w-5 rounded" checked={mitKinder} onChange={(e) => setMitKinder(e.target.checked)} /> 🧒 Kinder</label>
          <label className="flex items-center gap-2 font-semibold text-slate-600"><input type="checkbox" className="h-5 w-5 rounded" checked={mitPartner} onChange={(e) => setMitPartner(e.target.checked)} /> 👤 Ehepartner</label>
          <label className="flex items-center gap-2 font-semibold text-slate-600"><input type="checkbox" className="h-5 w-5 rounded" checked={mitTipps} onChange={(e) => setMitTipps(e.target.checked)} /> 📋 Bisherige Tipps übernehmen</label>
          <p className="text-xs text-slate-400">Familienmitglieder mit eigenem Login werden ebenfalls verknüpft (gleicher Benutzername/PIN, beide Vereine).</p>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Trete bei …' : 'Beitreten'}</button>
      </form>
      <button onClick={() => navigate('/tippen')} className="btn-ghost w-full">Abbrechen</button>
    </div>
  )
}
