import type { Mannschaft } from '../lib/types'

export function Team({ team, align = 'left' }: { team?: Mannschaft | null; align?: 'left' | 'right' }) {
  const name = team?.name ?? 'offen'
  return (
    <div className={`flex items-center gap-2 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <Flagge team={team} />
      <span className="truncate font-bold text-slate-700">{name}</span>
    </div>
  )
}

export function Flagge({ team, size = 28 }: { team?: Mannschaft | null; size?: number }) {
  if (team?.flagge_url) {
    return (
      <img
        src={team.flagge_url}
        alt={team.name}
        width={size}
        height={size}
        className="rounded-full object-cover ring-1 ring-black/10 bg-white"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    )
  }
  return (
    <span
      className="grid place-items-center rounded-full bg-slate-200 text-slate-500 text-xs font-bold ring-1 ring-black/10"
      style={{ width: size, height: size }}
    >
      {team?.kuerzel?.slice(0, 3) ?? '⚽'}
    </span>
  )
}
