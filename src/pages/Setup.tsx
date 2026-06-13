import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiAdmin } from '../lib/api'
import { Hinweis } from '../components/Ui'

/**
 * Einmalige Einrichtung des ersten Admin-Kontos.
 * Geschützt durch SETUP_SECRET (als Function-Secret in Supabase gesetzt).
 */
export function Setup() {
  const { applyToken } = useAuth()
  const navigate = useNavigate()
  const [setupSecret, setSecret] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [vorname, setVorname] = useState('Admin')
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setFehler(null); setBusy(true)
    try {
      const r: any = await apiAdmin('bootstrap_admin', { setupSecret, username, pin, vorname }, null)
      applyToken(r.token, 'Administration')
      navigate('/admin')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Fehler')
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <h1 className="mb-1 text-center text-2xl font-extrabold text-pitch-700">🛠️ Ersteinrichtung</h1>
      <p className="mb-5 text-center text-sm font-semibold text-slate-500">Erstes Admin-Konto anlegen</p>
      <form onSubmit={submit} className="card space-y-4 p-6">
        {fehler && <Hinweis kind="error">{fehler}</Hinweis>}
        <input className="input" placeholder="Setup-Secret" value={setupSecret} onChange={(e) => setSecret(e.target.value)} required />
        <input className="input" placeholder="Admin-Vorname" value={vorname} onChange={(e) => setVorname(e.target.value)} />
        <input className="input" placeholder="Benutzername" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="input tracking-widest" type="password" inputMode="numeric" placeholder="PIN (4–8 Ziffern)" value={pin} onChange={(e) => setPin(e.target.value)} required />
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Lege an …' : 'Admin anlegen'}</button>
      </form>
    </div>
  )
}
