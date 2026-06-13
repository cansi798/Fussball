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
    const { data: cur } = await db.from('teilnehmer').select('benutzer_id, vorname, nachname, rolle, haushalt, verein_id').eq('id', claims.teilnehmer_id).single()
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

      const c = cur as any
      const haushalt = c.haushalt
      const rolle = c.rolle === 'admin' ? 'elternteil' : c.rolle
      // Eigenes Profil im neuen Verein
      const { data: neu, error } = await db.from('teilnehmer').insert({
        verein_id: verein.id, vorname: c.vorname, nachname: c.nachname ?? null, rolle, haushalt, benutzer_id: benutzerId,
      }).select('id').single()
      if (error) throw error
      const replikate: { src: string; dst: string }[] = [{ src: claims.teilnehmer_id, dst: (neu as any).id }]

      // Familie mitnehmen (optional)
      const mitKinder = body.mitKinder !== false
      const mitPartner = body.mitPartner !== false
      if (mitKinder || mitPartner) {
        const { data: family } = await db.from('teilnehmer')
          .select('id, vorname, nachname, rolle, geburtsjahr, benutzer_id')
          .eq('haushalt', haushalt).eq('verein_id', c.verein_id)
        for (const m of (family as any[]) ?? []) {
          if (m.id === claims.teilnehmer_id) continue
          if (m.rolle === 'kind' && !mitKinder) continue
          if (m.rolle === 'elternteil' && !mitPartner) continue
          // schon im Zielverein?
          let q = db.from('teilnehmer').select('id').eq('verein_id', verein.id).eq('haushalt', haushalt)
          q = m.benutzer_id ? q.eq('benutzer_id', m.benutzer_id) : q.is('benutzer_id', null).eq('vorname', m.vorname)
          const { data: dupe } = await q.maybeSingle()
          if (dupe) { replikate.push({ src: m.id, dst: (dupe as any).id }); continue }
          const { data: created } = await db.from('teilnehmer').insert({
            verein_id: verein.id, vorname: m.vorname, nachname: m.nachname ?? null, rolle: m.rolle,
            geburtsjahr: m.geburtsjahr ?? null, haushalt, benutzer_id: m.benutzer_id ?? null,
          }).select('id').single()
          replikate.push({ src: m.id, dst: (created as any).id })
        }
      }

      // Tipps mitnehmen (optional, nur kommende Spiele)
      if (body.mitTipps !== false) {
        const now = Date.now()
        for (const r of replikate) {
          const { data: srcT } = await db.from('tipp')
            .select('spiel_id, tipp_heim, tipp_gast, spiel:spiel_id ( anstoss )')
            .eq('teilnehmer_id', r.src)
          for (const t of (srcT as any[]) ?? []) {
            if (!t.spiel?.anstoss || new Date(t.spiel.anstoss).getTime() <= now) continue
            await db.from('tipp').upsert(
              { teilnehmer_id: r.dst, spiel_id: t.spiel_id, tipp_heim: t.tipp_heim, tipp_gast: t.tipp_gast },
              { onConflict: 'teilnehmer_id,spiel_id' },
            )
          }
        }
      }

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
