import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavItem { to: string; label: string; icon: string }

export function Layout() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  if (!session) return null

  const items: NavItem[] = [
    { to: '/tippen', label: 'Tippen', icon: '✍️' },
    { to: '/spielplan', label: 'Spielplan', icon: '📅' },
    { to: '/tabellen', label: 'Tabelle', icon: '🏆' },
  ]
  if (session.rolle === 'kind') items.push({ to: '/meine-teams', label: 'Meine Teams', icon: '⭐' })
  if (session.rolle === 'admin') items.push({ to: '/admin', label: 'Admin', icon: '🛠️' })

  return (
    <div className="min-h-screen pb-24 sm:pb-0">
      {/* Kopfzeile */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">⚽</span>
            <div className="min-w-0">
              <div className="font-display font-extrabold leading-tight text-pitch-700">WM 2026 Tippspiel</div>
              <div className="truncate text-xs text-slate-500">
                {session.verein ?? 'Verein'} · {session.vorname}
                {session.rolle === 'admin' && ' (Admin)'}
              </div>
            </div>
          </div>

          {/* Desktop-Navigation */}
          <nav className="hidden sm:flex items-center gap-1">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm font-bold transition ${
                    isActive ? 'bg-pitch-100 text-pitch-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <span className="mr-1">{it.icon}</span>{it.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => { logout(); navigate('/login') }}
            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
          >
            Abmelden
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-5">
        <Outlet />
      </main>

      {/* Mobile-Navigation unten */}
      <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-black/5 bg-white/90 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-4xl">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition ${
                  isActive ? 'text-pitch-600' : 'text-slate-400'
                }`
              }
            >
              <span className="text-xl">{it.icon}</span>
              {it.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
