import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Spinner, Leer, SegmentSwitch } from '../components/Ui'
import type { RanglisteRow } from '../lib/types'

type Tab = 'gesamt' | 'kind' | 'elternteil'

function sortiere(a: RanglisteRow, b: RanglisteRow) {
  return b.punkte - a.punkte || b.exakt - a.exakt || b.teiltreffer - a.teiltreffer
    || a.vorname.localeCompare(b.vorname)
}

export function Tabellen() {
  const { supabase, session } = useAuth()
  const [rows, setRows] = useState<RanglisteRow[]>([])
  const [tab, setTab] = useState<Tab>('gesamt')
  const [vereinFilter, setVereinFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      setLoading(true)
      const { data } = await supabase.from('rangliste').select('*')
      if (aktiv) { setRows((data as RanglisteRow[]) ?? []); setLoading(false) }
    })()
    return () => { aktiv = false }
  }, [supabase])

  const istAdmin = session?.rolle === 'admin'
  const vereine = useMemo(
    () => [...new Map(rows.map((r) => [r.verein_id, r.verein_id])).keys()],
    [rows],
  )

  const gefiltert = useMemo(() => {
    let r = rows
    if (istAdmin && vereinFilter) r = r.filter((x) => x.verein_id === vereinFilter)
    if (tab !== 'gesamt') r = r.filter((x) => x.rolle === tab)
    return [...r].sort(sortiere)
  }, [rows, tab, vereinFilter, istAdmin])

  if (loading) return <Spinner label="Tabelle wird geladen …" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-pitch-700">🏆 Tabelle</h1>
        <SegmentSwitch<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'gesamt', label: 'Gesamt' },
            { value: 'kind', label: 'Kinder' },
            { value: 'elternteil', label: 'Eltern' },
          ]}
        />
      </div>

      {istAdmin && vereine.length > 1 && (
        <select className="input max-w-xs" value={vereinFilter} onChange={(e) => setVereinFilter(e.target.value)}>
          <option value="">Alle Vereine</option>
          {vereine.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      )}

      {gefiltert.length === 0 ? (
        <Leer>Noch keine Platzierungen vorhanden.</Leer>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-pitch-50 text-xs font-extrabold uppercase tracking-wide text-pitch-700">
                <th className="px-3 py-3">#</th>
                <th className="px-2 py-3">Name</th>
                <th className="px-2 py-3 text-right">Pkt</th>
                <th className="hidden px-2 py-3 text-right sm:table-cell" title="Exakte Tipps">✓✓</th>
                <th className="hidden px-2 py-3 text-right sm:table-cell" title="Teiltreffer">✓</th>
                <th className="hidden px-3 py-3 text-right sm:table-cell" title="Abgegebene Tipps">Tipps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gefiltert.map((r, i) => {
                const ich = r.teilnehmer_id === session?.teilnehmer_id
                const medal = ['🥇', '🥈', '🥉'][i]
                return (
                  <tr key={r.teilnehmer_id} className={ich ? 'bg-sun-400/10' : ''}>
                    <td className="px-3 py-3 font-black text-slate-500">{medal ?? i + 1}</td>
                    <td className="px-2 py-3">
                      <span className="font-bold text-slate-700">{r.vorname}{r.nachname ? ` ${r.nachname}` : ''}</span>
                      {ich && <span className="ml-2 pill bg-sun-400 text-amber-900 text-[10px]">du</span>}
                      <span className="ml-2 align-middle text-[10px] font-bold uppercase text-slate-300">
                        {r.rolle === 'kind' ? 'Kind' : 'Eltern'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right text-lg font-black text-pitch-700">{r.punkte}</td>
                    <td className="hidden px-2 py-3 text-right font-bold text-slate-500 sm:table-cell">{r.exakt}</td>
                    <td className="hidden px-2 py-3 text-right font-bold text-slate-500 sm:table-cell">{r.teiltreffer}</td>
                    <td className="hidden px-3 py-3 text-right font-bold text-slate-400 sm:table-cell">{r.tipps_gesamt}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
