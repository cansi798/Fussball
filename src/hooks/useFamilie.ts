import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { Teilnehmer } from '../lib/types'

/**
 * Spieler, für die der eingeloggte Benutzer tippen darf:
 * - sich selbst
 * - (nur Eltern) alle Kinder im selben Haushalt
 */
export function useFamilie() {
  const { session, supabase } = useAuth()
  const [players, setPlayers] = useState<Teilnehmer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let aktiv = true
    setLoading(true)
    ;(async () => {
      let list: Teilnehmer[] = []
      if (session.rolle === 'elternteil') {
        // Eltern dürfen für den ganzen Haushalt tippen (Kinder + anderer Elternteil)
        const { data } = await supabase
          .from('teilnehmer').select('*')
          .eq('haushalt', session.haushalt!)
          .eq('verein_id', session.verein_id!)
        list = data ?? []
      } else {
        const { data } = await supabase.from('teilnehmer').select('*').eq('id', session.teilnehmer_id)
        list = data ?? []
      }
      // Eigenes Profil zuerst, dann Kinder alphabetisch
      list.sort((a, b) =>
        a.id === session.teilnehmer_id ? -1 : b.id === session.teilnehmer_id ? 1 : a.vorname.localeCompare(b.vorname),
      )
      if (aktiv) { setPlayers(list); setLoading(false) }
    })()
    return () => { aktiv = false }
  }, [session?.teilnehmer_id, supabase])

  return { players, loading }
}
