import type { ReactNode } from 'react'

export function Spinner({ label = 'Lädt …' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-pitch-700">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-pitch-200 border-t-pitch-600" />
      <span className="font-bold">{label}</span>
    </div>
  )
}

export function Hinweis({ kind = 'info', children }: { kind?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  const farbe =
    kind === 'error' ? 'bg-red-50 text-red-700 ring-red-200'
    : kind === 'ok' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-sky-50 text-sky-700 ring-sky-200'
  return <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ${farbe}`}>{children}</div>
}

export function Leer({ children }: { children: ReactNode }) {
  return <div className="card p-8 text-center text-slate-500 font-semibold">{children}</div>
}

export function SegmentSwitch<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-2xl bg-white/70 p-1 ring-1 ring-black/5 shadow-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            value === o.value ? 'bg-pitch-500 text-white shadow' : 'text-slate-600 hover:text-pitch-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
