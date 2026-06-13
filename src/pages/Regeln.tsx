import { punkteFuer } from '../lib/scoring'
import type { Phase, Sieger } from '../lib/types'

interface BeispielProps {
  tippH: number; tippG: number; realH: number; realG: number
  phase?: Phase; elfmeter?: Sieger | null; note?: string
}

function Beispiel({ tippH, tippG, realH, realG, phase = 'gruppe', elfmeter = null, note }: BeispielProps) {
  const p = punkteFuer(tippH, tippG, realH, realG, phase, elfmeter)
  const farbe = p >= 3 ? 'bg-emerald-100 text-emerald-700' : p >= 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
      <div className="text-sm">
        <span className="font-bold text-slate-700">Tipp {tippH}:{tippG}</span>
        <span className="mx-2 text-slate-400">·</span>
        <span className="text-slate-500">Ergebnis {realH}:{realG}{elfmeter ? ' n. E.' : ''}</span>
        {note && <div className="text-xs text-slate-400">{note}</div>}
      </div>
      <span className={`pill ${farbe} whitespace-nowrap`}>{p} {p === 1 ? 'Punkt' : 'Punkte'}</span>
    </div>
  )
}

export function Regeln() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-pitch-700">📖 Punkteregeln</h1>

      <section className="card space-y-3 p-5">
        <h2 className="font-extrabold text-pitch-700">So gibt es Punkte</h2>
        <ul className="space-y-1.5 font-semibold text-slate-600">
          <li>🎯 <b>Exaktes Ergebnis</b> getippt → <b>3 Punkte</b></li>
          <li>½ <b>Eine Mannschaft</b> mit richtiger Torzahl → <b>1 Punkt</b></li>
          <li>❌ Sonst → <b>0 Punkte</b></li>
        </ul>
        <div className="space-y-2 pt-1">
          <Beispiel tippH={2} tippG={1} realH={2} realG={1} note="Beide Tore exakt richtig" />
          <Beispiel tippH={2} tippG={0} realH={2} realG={1} note="Heim-Tore (2) stimmen" />
          <Beispiel tippH={0} tippG={1} realH={2} realG={1} note="Gast-Tore (1) stimmen" />
          <Beispiel tippH={1} tippG={3} realH={2} realG={1} note="Nichts stimmt" />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-extrabold text-pitch-700">K.-o.-Spiele (ab Achtelfinale)</h2>
        <p className="text-sm font-semibold text-slate-600">
          Gewertet wird der Stand <b>nach Verlängerung</b>. Geht es ins
          <b> Elfmeterschießen</b>, gibt es <b>+1 Bonuspunkt</b>, wenn du die
          weiterkommende Mannschaft als Sieger getippt hast.
        </p>
        <div className="space-y-2">
          <Beispiel tippH={2} tippG={1} realH={1} realG={1} phase="ko" elfmeter="heim" note="Gast-Tor stimmt (1 Pkt) + Sieger Heim richtig (+1)" />
          <Beispiel tippH={1} tippG={1} realH={1} realG={1} phase="ko" elfmeter="heim" note="Exakt (3 Pkt) – aber Unentschieden getippt, kein Sieger-Bonus" />
          <Beispiel tippH={1} tippG={2} realH={1} realG={1} phase="ko" elfmeter="heim" note="Heim-Tor stimmt (1 Pkt), aber falscher Sieger getippt" />
        </div>
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-extrabold text-pitch-700">Wann & wie wird getippt</h2>
        <ul className="space-y-1.5 text-sm font-semibold text-slate-600">
          <li>⏰ Tippen ist nur <b>vor dem Anpfiff</b> möglich – bis dahin beliebig änderbar.</li>
          <li>🚫 Verpasste Spiele zählen als <b>kein Tipp = 0 Punkte</b>.</li>
          <li>📊 In der Tabelle entscheidet bei <b>Gleichstand</b>: mehr exakte Tipps, dann mehr Teiltreffer.</li>
        </ul>
      </section>
    </div>
  )
}
