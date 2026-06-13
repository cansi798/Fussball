// Mehrfach-Vereinszugehörigkeit:
//  - list:   alle Vereine dieses Logins
//  - switch: Sitzung auf ein anderes eigenes Profil umschalten (neues JWT)
//  - join:   mit Einladungscode einem weiteren Verein beitreten (neues Profil)
import { serviceClient, jwtSecret } from '../_shared/db.ts'
import { verifySecret, normCode } from '../_shared/crypto.ts'
import { signAppJwt, verifyAppJwt } from '../_shared/jwt.ts'
import { json, handleOptions } from '../_shared/cors.ts'

type Db = ReturnType<typeof serviceClient>

async function listMemberships(db: Db, benutzerId: string) {
  const { data } = await db.from('teilnehmer')
    .select('id, verein_id, rolle, haushalt, vorname, verein:verein_id ( name, kuerzel )')
    .eq('benutzer_id', benutzerId)
  return ((data as any[]) ?? [])
    .filter((t) => t.verein?.kuerzel !== 'ADMIN')
    .map((t) => ({ teilnehmer_id: t.id, verein_id: t.verein_id, verein: t.verein?.name ?? null, rolle: t.rolle, haushalt: t.haushalt, vorname: t.vorname }))
}

async function tokenFor(db: Db, teilnehmerId: string) {
  const { data: t } = await db.from('teilnehmer')
    .select('id, verein_id, rolle, haushalt, vorname, verein:verein_id ( name )')
    .eq('id', teilnehmerId).single()
  const tn = t as any
  const token = await signAppJwt({
    teilnehmer_id: tn.id, verein_id: tn.verein_id, rolle: tn.rolle, haushalt: tn.haushalt, vorname: tn.vorname,
  }, jwtSecret())
  return { token, verein: tn.verein?.name ?? null, vorname: tn.vorname, rolle: tn.rolle }
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const claims = await verifyAppJwt(auth.replace(/^Bearer\s+/i, ''), jwtSecret())
    if (!claims) return json({ error: 'Nicht angemeldet.' }, 401)

    const db = serviceClient()
    // benutzer_id des aktuellen Profils ermitteln
    const { data: cur } = await db.from('teilnehmer').select('benutzer_id, vorname, rolle').eq('id', claims.teilnehmer_id).single()
    const benutzerId = (cur as any)?.benutzer_id
    if (!benutzerId) return json({ error: 'Dieser Login kann keine Vereine wechseln.' }, 400)

    const body = await req.json().catch(() => ({}))
    const action = body.action as string

    if (action === 'list') {
      return json({ memberships: await listMemberships(db, benutzerId) })
    }

    if (action === 'switch') {
      const target = body.teilnehmer_id as string
      const { data: t } = await db.from('teilnehmer').select('id, benutzer_id').eq('id', target).maybeSingle()
      if (!t || (t as any).benutzer_id !== benutzerId) return json({ error: 'Kein Zugriff auf dieses Profil.' }, 403)
      const prof = await tokenFor(db, target)
      return json({ ...prof, memberships: await listMemberships(db, benutzerId) })
    }

    if (action === 'join') {
      const code = normCode(body.einladungscode ?? '')
      if (!code) return json({ error: 'Einladungscode fehlt.' }, 400)
      // Verein per Code finden
      const { data: vereine } = await db.from('verein').select('id, name, einladungscode_hash')
      let verein: { id: string; name: string } | null = null
      for (const v of (vereine as any[]) ?? []) {
        if (await verifySecret(code, v.einladungscode_hash)) { verein = { id: v.id, name: v.name }; break }
      }
      if (!verein) return json({ error: 'Ungültiger Einladungscode.' }, 403)

      // Schon Mitglied?
      const { data: vorhanden } = await db.from('teilnehmer').select('id').eq('benutzer_id', benutzerId).eq('verein_id', verein.id).maybeSingle()
      if (vorhanden) {
        const prof = await tokenFor(db, (vorhanden as any).id)
        return json({ ...prof, memberships: await listMemberships(db, benutzerId), hinweis: 'Du warst bereits in diesem Verein.' })
      }

      const rolle = (cur as any).rolle === 'admin' ? 'elternteil' : (cur as any).rolle
      const haushalt = (body.haushalt?.trim()) || (cur as any).vorname
      const { data: neu, error } = await db.from('teilnehmer').insert({
        verein_id: verein.id, vorname: (cur as any).vorname, rolle, haushalt, benutzer_id: benutzerId,
      }).select('id').single()
      if (error) throw error
      const prof = await tokenFor(db, (neu as any).id)
      return json({ ...prof, memberships: await listMemberships(db, benutzerId) })
    }

    if (action === 'copy_to_all') {
      // Eigene Tipps des aktiven Profils für noch nicht angepfiffene Spiele
      const { data: myTipps } = await db.from('tipp')
        .select('spiel_id, tipp_heim, tipp_gast, spiel:spiel_id ( anstoss )')
        .eq('teilnehmer_id', claims.teilnehmer_id)
      const now = Date.now()
      const upcoming = ((myTipps as any[]) ?? []).filter((t) => t.spiel?.anstoss && new Date(t.spiel.anstoss).getTime() > now)
      // Andere Profile desselben Logins (= andere Vereine)
      const members = await listMemberships(db, benutzerId)
      const targets = members.filter((m) => m.teilnehmer_id !== claims.teilnehmer_id)
      let uebertragen = 0
      for (const target of targets) {
        for (const t of upcoming) {
          await db.from('tipp').upsert(
            { teilnehmer_id: target.teilnehmer_id, spiel_id: t.spiel_id, tipp_heim: t.tipp_heim, tipp_gast: t.tipp_gast },
            { onConflict: 'teilnehmer_id,spiel_id' },
          )
          uebertragen++
        }
      }
      return json({ ok: true, uebertragen, vereine: targets.length })
    }

    return json({ error: `Unbekannte Aktion: ${action}` }, 400)
  } catch (e) {
    return json({ error: `Serverfehler: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
