import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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

export default function App() {
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
