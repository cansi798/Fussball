import type { Phase, Sieger } from './types'

type Tendenz = 'heim' | 'gast' | 'remis'

/** Ausgang eines Spiels/Tipps: Heimsieg, Gastsieg oder Unentschieden. */
function tendenz(h: number, g: number): Tendenz {
  return h > g ? 'heim' : h < g ? 'gast' : 'remis'
}

/**
 * Punkteberechnung – exakt gespiegelt zur SQL-Funktion `punkte_fuer`.
 * Regel (gestaffelt, höchste zutreffende Stufe):
 *   - exaktes Ergebnis (beide Torzahlen) = 3
 *   - genau eine Torzahl richtig = 2
 *   - richtige Tendenz (richtiger Sieger bzw. richtiges Unentschieden) = 1
 *   - sonst 0
 * K.o. + Elfmeterschießen: +1 Bonus, wenn der Tipp die weiterkommende
 * Mannschaft als Sieger hatte. Verglichen wird der Stand NACH Verlängerung.
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

  let basis: number
  if (treffer === 2) basis = 3
  else if (treffer === 1) basis = 2
  else if (tendenz(tippH, tippG) === tendenz(realH, realG)) basis = 1
  else basis = 0

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
): 'exakt' | 'teiltreffer' | 'tendenz' | 'daneben' | 'offen' {
  if (realH === null || realG === null) return 'offen'
  if (tippH === realH && tippG === realG) return 'exakt'
  if (tippH === realH || tippG === realG) return 'teiltreffer'
  if (tendenz(tippH, tippG) === tendenz(realH, realG)) return 'tendenz'
  return 'daneben'
}

/**
 * Aufschlüsselung eines Tipps für die Rückschau ("Meine Tipps").
 * Liefert die Klassifikation (siehe `tippGuete`) und ob der K.o.-Elfmeter-
 * Sieger-Bonus gegriffen hat – rein zur ERKLÄRUNG. Die tatsächlichen Punkte
 * stammen aus dem gespeicherten `tipp.punkte` (SQL-Trigger), nicht von hier.
 */
export function tippAufschluesselung(
  tippH: number, tippG: number,
  realH: number | null, realG: number | null,
  phase: Phase, elfmeter: Sieger | null,
): { guete: 'exakt' | 'teiltreffer' | 'tendenz' | 'daneben' | 'offen'; koBonus: boolean } {
  const guete = tippGuete(tippH, tippG, realH, realG)
  let koBonus = false
  if (phase === 'ko' && elfmeter && realH !== null && realG !== null) {
    const getippterSieger: Sieger | null =
      tippH > tippG ? 'heim' : tippG > tippH ? 'gast' : null
    koBonus = getippterSieger != null && getippterSieger === elfmeter
  }
  return { guete, koBonus }
}
