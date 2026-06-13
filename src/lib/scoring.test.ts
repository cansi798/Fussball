import { describe, it, expect } from 'vitest'
import { punkteFuer, tippGuete } from './scoring'

describe('punkteFuer – Gruppenphase', () => {
  it('exaktes Ergebnis = 3', () => {
    expect(punkteFuer(2, 1, 2, 1, 'gruppe', null)).toBe(3)
  })
  it('eine Torzahl richtig (Heim) = 1', () => {
    expect(punkteFuer(2, 0, 2, 1, 'gruppe', null)).toBe(1)
  })
  it('eine Torzahl richtig (Gast) = 1', () => {
    expect(punkteFuer(0, 1, 2, 1, 'gruppe', null)).toBe(1)
  })
  it('komplett daneben = 0', () => {
    expect(punkteFuer(1, 3, 2, 1, 'gruppe', null)).toBe(0)
  })
  it('kein Ergebnis vorhanden = 0', () => {
    expect(punkteFuer(2, 1, null, null, 'gruppe', null)).toBe(0)
  })
})

describe('punkteFuer – K.o. mit Elfmeterschießen (Sieger Heim)', () => {
  it('Teiltreffer + Sieger-Bonus = 2 (Tipp 2:1)', () => {
    // real 1:1 nach Verl., Gast-1 stimmt = 1 Punkt, Heim als Sieger getippt = +1
    expect(punkteFuer(2, 1, 1, 1, 'ko', 'heim')).toBe(2)
  })
  it('exaktes Unentschieden = 3, kein Bonus (Tipp 1:1)', () => {
    expect(punkteFuer(1, 1, 1, 1, 'ko', 'heim')).toBe(3)
  })
  it('falscher Sieger = kein Bonus (Tipp 1:2)', () => {
    // Heim-1 stimmt = 1 Punkt, Gast als Sieger getippt -> kein Bonus
    expect(punkteFuer(1, 2, 1, 1, 'ko', 'heim')).toBe(1)
  })
  it('K.o. ohne Elfmeter: normale Wertung', () => {
    expect(punkteFuer(2, 1, 2, 1, 'ko', null)).toBe(3)
  })
})

describe('tippGuete', () => {
  it('klassifiziert korrekt', () => {
    expect(tippGuete(2, 1, 2, 1)).toBe('exakt')
    expect(tippGuete(2, 0, 2, 1)).toBe('teiltreffer')
    expect(tippGuete(0, 0, 2, 1)).toBe('daneben')
    expect(tippGuete(2, 1, null, null)).toBe('offen')
  })
})
