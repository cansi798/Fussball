const TZ = 'Europe/Berlin'

export function formatDatum(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short', day: 'numeric', month: 'long', timeZone: TZ,
  }).format(new Date(iso))
}

export function formatZeit(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit', minute: '2-digit', timeZone: TZ,
  }).format(new Date(iso)) + ' Uhr'
}

/** Tages-Schlüssel (YYYY-MM-DD in Berliner Zeit) zum Gruppieren des Spielplans. */
export function tagKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ,
  }).format(new Date(iso))
}

export function tagLabel(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ,
  }).format(new Date(iso))
}

export function istVorbei(anstossIso: string): boolean {
  return Date.now() >= new Date(anstossIso).getTime()
}

// Zeitfenster, in dem ein angepfiffenes Spiel als "live" gilt (Minuten).
// 90 Min + Pausen + Nachspielzeit + Puffer für Verlängerung/Elfmeter.
const LIVE_FENSTER_MIN = 150

/**
 * Robuster Spielstatus – unabhängig vom OpenLigaDB-Flag `ist_beendet`, das
 * teils Stunden nachhinkt. Nach dem Live-Fenster gilt ein Spiel als beendet,
 * auch wenn die Quelle es noch nicht als beendet markiert hat.
 */
export function spielStatus(
  spiel: { anstoss: string; ist_beendet: boolean },
): 'kommend' | 'live' | 'beendet' {
  if (!istVorbei(spiel.anstoss)) return 'kommend'
  if (spiel.ist_beendet) return 'beendet'
  const minutenHer = (Date.now() - new Date(spiel.anstoss).getTime()) / 60000
  return minutenHer >= LIVE_FENSTER_MIN ? 'beendet' : 'live'
}
