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
