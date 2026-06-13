import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SUPABASE_URL, ANON_KEY } from './lib/supabase'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Setup } from './pages/Setup'
import { Tippen } from './pages/Tippen'
import { Spielplan } from './pages/Spielplan'
import { Tabellen } from './pages/Tabellen'
import { MeineTeams } from './pages/MeineTeams'
import { Admin } from './pages/Admin'

function RequireAuth() {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return <Layout />
}

function ConfigError() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
      <div className="text-5xl">⚙️</div>
      <h1 className="mt-3 text-2xl font-extrabold text-pitch-700">Konfiguration fehlt</h1>
      <p className="mt-2 font-semibold text-slate-600">
        Die Verbindung zu Supabase ist nicht konfiguriert. Beim Build müssen die
        Variablen <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> und{' '}
        <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> gesetzt sein
        (GitHub → Settings → Secrets → Actions), danach den Deploy-Workflow erneut starten.
      </p>
    </div>
  )
}

export default function App() {
  if (!SUPABASE_URL || !ANON_KEY) return <ConfigError />
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registrieren" element={<Register />} />
          <Route path="/setup" element={<Setup />} />
          <Route element={<RequireAuth />}>
            <Route path="/tippen" element={<Tippen />} />
            <Route path="/spielplan" element={<Spielplan />} />
            <Route path="/tabellen" element={<Tabellen />} />
            <Route path="/meine-teams" element={<MeineTeams />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/tippen" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
