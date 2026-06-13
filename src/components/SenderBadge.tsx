const FARBEN: Record<string, string> = {
  ard: 'bg-blue-100 text-blue-800',
  zdf: 'bg-orange-100 text-orange-800',
  magentatv: 'bg-pink-100 text-pink-800',
  magenta: 'bg-pink-100 text-pink-800',
}

export function SenderBadge({ sender }: { sender?: string | null }) {
  if (!sender) return null
  const key = sender.toLowerCase().replace(/\s+/g, '')
  const farbe = FARBEN[key] ?? 'bg-slate-100 text-slate-700'
  return (
    <span className={`pill inline-flex items-center gap-1 ${farbe}`} title="Im deutschen TV">
      📺 {sender}
    </span>
  )
}
