import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { spielStatus } from './format'

// Feste "Jetzt"-Zeit, damit die zeitbasierte Logik deterministisch testbar ist.
const JETZT = new Date('2026-06-14T12:00:00Z')

function vor(minuten: number): string {
  return new Date(JETZT.getTime() - minuten * 60_000).toISOString()
}
function inZukunft(minuten: number): string {
  return new Date(JETZT.getTime() + minuten * 60_000).toISOString()
}

describe('spielStatus', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(JETZT) })
  afterEach(() => { vi.useRealTimers() })

  it('vor Anpfiff -> kommend', () => {
    expect(spielStatus({ anstoss: inZukunft(60), ist_beendet: false })).toBe('kommend')
  })
  it('kurz nach Anpfiff, nicht beendet -> live', () => {
    expect(spielStatus({ anstoss: vor(30), ist_beendet: false })).toBe('live')
  })
  it('ist_beendet=true -> beendet (egal wie spät)', () => {
    expect(spielStatus({ anstoss: vor(30), ist_beendet: true })).toBe('beendet')
  })
  it('lange nach Anpfiff trotz fehlendem Flag -> beendet (OpenLigaDB hinkt nach)', () => {
    expect(spielStatus({ anstoss: vor(600), ist_beendet: false })).toBe('beendet')
  })
  it('exakt an der Live-Fenster-Grenze (150 Min) -> beendet', () => {
    expect(spielStatus({ anstoss: vor(150), ist_beendet: false })).toBe('beendet')
  })
})
