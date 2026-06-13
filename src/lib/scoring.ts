import type { Phase, Sieger } from './types'

/**
 * Punkteberechnung – exakt gespiegelt zur SQL-Funktion `punkte_fuer`.
 * Regel: exaktes Ergebnis = 3, genau eine korrekte Torzahl = 1, sonst 0.
 * K.o. + Elfmeterschießen: +1 Bonus, wenn der Tipp die weiterkommende
 * Mannschaft als Sieger hatte (Nicht-Unentschieden zugunsten des Siegers).
 * Verglichen wird der Stand NACH Verlängerung.
 */
export function punkteFuer(
  tippH: number,
  tippG: number,
  realH: number | null,
  realG: number | null,
  phase: Phase,
  elfmeter: Sieger | null,
): number {
  if (realH === null || realG === null) return 0

  let treffer = 0
  if (tippH === realH) treffer++
  if (tippG === realG) treffer++

  let basis = treffer === 2 ? 3 : treffer === 1 ? 1 : 0

  if (phase === 'ko' && elfmeter) {
    const getippterSieger: Sieger | null =
      tippH > tippG ? 'heim' : tippG > tippH ? 'gast' : null
    if (getippterSieger && getippterSieger === elfmeter) basis += 1
  }

  return basis
}

/** Kurzklassifikation für die Anzeige eines bewerteten Tipps. */
export function tippGuete(
  tippH: number, tippG: number, realH: number | null, realG: number | null,
): 'exakt' | 'teiltreffer' | 'daneben' | 'offen' {
  if (realH === null || realG === null) return 'offen'
  if (tippH === realH && tippG === realG) return 'exakt'
  if (tippH === realH || tippG === realG) return 'teiltreffer'
  return 'daneben'
}
