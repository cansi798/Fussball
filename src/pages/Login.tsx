import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Hinweis } from '../components/Ui'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null); setBusy(true)
    try {
      await login(username.trim(), pin.trim())
      navigate('/tippen')
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Login fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <div className="text-6xl">⚽</div>
        <h1 className="mt-2 text-3xl font-extrabold text-pitch-700">WM 2026 Tippspiel</h1>
        <p className="text-slate-500 font-semibold">Willkommen zurück!</p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        {fehler && <Hinweis kind="error">{fehler}</Hinweis>}
        <div>
          <label className="mb-1 block font-bold text-slate-600">Benutzername</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)}
            autoComplete="username" autoCapitalize="none" required />
        </div>
        <div>
          <label className="mb-1 block font-bold text-slate-600">PIN</label>
          <input className="input tracking-widest" value={pin} onChange={(e) => setPin(e.target.value)}
            inputMode="numeric" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn-primary w-full text-lg" disabled={busy}>
          {busy ? 'Moment …' : 'Einloggen'}
        </button>
      </form>

      <p className="mt-5 text-center font-semibold text-slate-600">
        Noch kein Konto?{' '}
        <Link to="/registrieren" className="text-pitch-600 underline">Jetzt registrieren</Link>
      </p>
    </div>
  )
}
