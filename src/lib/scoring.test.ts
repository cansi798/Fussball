import { describe, it, expect } from 'vitest'
import { punkteFuer, tippGuete, tippAufschluesselung } from './scoring'

describe('punkteFuer – Gruppenphase', () => {
  it('exaktes Ergebnis = 3', () => {
    expect(punkteFuer(2, 1, 2, 1, 'gruppe', null)).toBe(3)
  })
  it('eine Torzahl richtig (Heim) = 2', () => {
    expect(punkteFuer(2, 0, 2, 1, 'gruppe', null)).toBe(2)
  })
  it('eine Torzahl richtig (Gast) = 2', () => {
    expect(punkteFuer(0, 1, 2, 1, 'gruppe', null)).toBe(2)
  })
  it('komplett daneben = 0', () => {
    expect(punkteFuer(1, 3, 2, 1, 'gruppe', null)).toBe(0)
  })
  it('kein Ergebnis vorhanden = 0', () => {
    expect(punkteFuer(2, 1, null, null, 'gruppe', null)).toBe(0)
  })
})

describe('punkteFuer – K.o. mit Elfmeterschießen (Sieger Heim)', () => {
  it('Teiltreffer (2) + Sieger-Bonus (1) = 3 (Tipp 2:1)', () => {
    // real 1:1 nach Verl., Gast-1 stimmt = 2 Punkte, Heim als Sieger getippt = +1
    expect(punkteFuer(2, 1, 1, 1, 'ko', 'heim')).toBe(3)
  })
  it('exaktes Unentschieden = 3, kein Bonus (Tipp 1:1)', () => {
    expect(punkteFuer(1, 1, 1, 1, 'ko', 'heim')).toBe(3)
  })
  it('falscher Sieger = kein Bonus (Tipp 1:2)', () => {
    // Heim-1 stimmt = 2 Punkte, Gast als Sieger getippt -> kein Bonus
    expect(punkteFuer(1, 2, 1, 1, 'ko', 'heim')).toBe(2)
  })
  it('K.o. ohne Elfmeter: normale Wertung', () => {
    expect(punkteFuer(2, 1, 2, 1, 'ko', null)).toBe(3)
  })
})

describe('punkteFuer – Tendenz (gestaffelt, 1 Punkt)', () => {
  it('richtiger Heimsieg ohne Tor-Treffer = 1', () => {
    expect(punkteFuer(2, 1, 1, 0, 'gruppe', null)).toBe(1)
  })
  it('richtiger Gastsieg ohne Tor-Treffer = 1', () => {
    expect(punkteFuer(1, 2, 0, 3, 'gruppe', null)).toBe(1)
  })
  it('richtiges Unentschieden ohne Tor-Treffer = 1', () => {
    expect(punkteFuer(1, 1, 2, 2, 'gruppe', null)).toBe(1)
  })
  it('falsche Tendenz ohne Tor-Treffer = 0', () => {
    expect(punkteFuer(3, 0, 0, 2, 'gruppe', null)).toBe(0)
  })
  it('Remis getippt, aber Sieg = 0', () => {
    expect(punkteFuer(1, 1, 2, 0, 'gruppe', null)).toBe(0)
  })
  it('exakt zählt weiter 3 (nicht gestapelt)', () => {
    expect(punkteFuer(2, 1, 2, 1, 'gruppe', null)).toBe(3)
  })
  it('K.o.: Remis getippt, real 0:0 + Elfmeter -> Tendenz=1, kein Sieger-Bonus', () => {
    // Remis-Tipp 1:1, real 0:0 (kein Tor-Treffer), Elfmeter Heim -> nur Tendenz
    expect(punkteFuer(1, 1, 0, 0, 'ko', 'heim')).toBe(1)
  })
})

describe('tippGuete', () => {
  it('klassifiziert korrekt', () => {
    expect(tippGuete(2, 1, 2, 1)).toBe('exakt')
    expect(tippGuete(2, 0, 2, 1)).toBe('teiltreffer')
    expect(tippGuete(2, 1, 1, 0)).toBe('tendenz')   // Heimsieg richtig, kein Tor
    expect(tippGuete(1, 1, 2, 2)).toBe('tendenz')   // Remis richtig, kein Tor
    expect(tippGuete(2, 1, 0, 3)).toBe('daneben')
    expect(tippGuete(2, 1, null, null)).toBe('offen')
  })
})

describe('tippAufschluesselung', () => {
  it('Gruppe exakt – kein K.o.-Bonus', () => {
    expect(tippAufschluesselung(2, 1, 2, 1, 'gruppe', null)).toEqual({ guete: 'exakt', koBonus: false })
  })
  it('Gruppe Teiltreffer', () => {
    expect(tippAufschluesselung(2, 0, 2, 1, 'gruppe', null)).toEqual({ guete: 'teiltreffer', koBonus: false })
  })
  it('Gruppe daneben', () => {
    expect(tippAufschluesselung(0, 0, 2, 1, 'gruppe', null)).toEqual({ guete: 'daneben', koBonus: false })
  })
  it('Gruppe Tendenz (Remis richtig, kein Tor)', () => {
    expect(tippAufschluesselung(1, 1, 2, 2, 'gruppe', null)).toEqual({ guete: 'tendenz', koBonus: false })
  })
  it('K.o. mit Elfmeter: Teiltreffer + richtiger Sieger -> Bonus', () => {
    expect(tippAufschluesselung(2, 1, 1, 1, 'ko', 'heim')).toEqual({ guete: 'teiltreffer', koBonus: true })
  })
  it('K.o. mit Elfmeter: falscher Sieger -> kein Bonus', () => {
    expect(tippAufschluesselung(1, 2, 1, 1, 'ko', 'heim')).toEqual({ guete: 'teiltreffer', koBonus: false })
  })
  it('K.o. mit Elfmeter: Unentschieden getippt -> kein Sieger, kein Bonus', () => {
    expect(tippAufschluesselung(1, 1, 1, 1, 'ko', 'heim')).toEqual({ guete: 'exakt', koBonus: false })
  })
  it('K.o. ohne Elfmeter: kein Bonus', () => {
    expect(tippAufschluesselung(2, 1, 2, 1, 'ko', null)).toEqual({ guete: 'exakt', koBonus: false })
  })
  it('noch kein Ergebnis -> offen, kein Bonus', () => {
    expect(tippAufschluesselung(2, 1, null, null, 'ko', 'heim')).toEqual({ guete: 'offen', koBonus: false })
  })
})
