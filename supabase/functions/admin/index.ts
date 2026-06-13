// Admin-Funktionen, die Server-Logik brauchen (Hashing):
//  - bootstrap_admin: legt den ersten Admin an (durch SETUP_SECRET geschützt)
//  - create_verein:   Verein + gehashten Einladungscode anlegen
//  - reset_pin:       PIN eines Benutzers neu setzen
// Ergebnis-Overrides & tv_sender macht der Admin direkt per RLS im Client.
import { serviceClient, jwtSecret } from '../_shared/db.ts'
import { hashSecret, normCode } from '../_shared/crypto.ts'
import { signAppJwt, verifyAppJwt } from '../_shared/jwt.ts'
import { json, handleOptions } from '../_shared/cors.ts'

async function requireAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return false
  const claims = await verifyAppJwt(token, jwtSecret())
  return !!claims && claims.rolle === 'admin'
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = await req.json()
    const action = body.action as string
    const db = serviceClient()

    // --- Bootstrap: erster Admin, geschützt durch SETUP_SECRET ---
    if (action === 'bootstrap_admin') {
      const setup = Deno.env.get('SETUP_SECRET')
      if (!setup || body.setupSecret !== setup) return json({ error: 'Nicht autorisiert.' }, 401)
      if (!body.username || !body.pin) return json({ error: 'username + pin nötig.' }, 400)

      // Admin braucht einen teilnehmer-Eintrag (ohne Verein) als Login-Ziel.
      // Dazu legen wir einen technischen "Admin"-Verein an, falls nötig.
      let { data: av } = await db.from('verein').select('id').eq('kuerzel', 'ADMIN').maybeSingle()
      if (!av) {
        const ins = await db.from('verein').insert({
          name: 'Administration', kuerzel: 'ADMIN',
          einladungscode_hash: await hashSecret(crypto.randomUUID()),
        }).select('id').single()
        av = ins.data
      }
      const { data: tn } = await db.from('teilnehmer').insert({
        verein_id: av!.id, vorname: body.vorname ?? 'Admin', rolle: 'admin', haushalt: 'admin',
      }).select('id').single()
      await db.from('benutzer').insert({
        teilnehmer_id: tn!.id, username: body.username, pin_hash: await hashSecret(body.pin),
      })
      const token = await signAppJwt({
        teilnehmer_id: tn!.id, verein_id: av!.id, rolle: 'admin', haushalt: 'admin', vorname: body.vorname ?? 'Admin',
      }, jwtSecret())
      return json({ ok: true, token })
    }

    // --- Ab hier: Admin-JWT erforderlich ---
    if (!(await requireAdmin(req))) return json({ error: 'Nur für Admins.' }, 403)

    if (action === 'create_verein') {
      if (!body.name || !body.kuerzel || !body.einladungscode) {
        return json({ error: 'name, kuerzel, einladungscode nötig.' }, 400)
      }
      const c = normCode(body.einladungscode)
      const { data, error } = await db.from('verein').insert({
        name: body.name,
        kuerzel: body.kuerzel,
        einladungscode: c,
        einladungscode_hash: await hashSecret(c),
      }).select('id, name, kuerzel').single()
      if (error) throw error
      return json({ ok: true, verein: data })
    }

    if (action === 'set_code') {
      if (!body.verein_id || !body.einladungscode) return json({ error: 'verein_id + einladungscode nötig.' }, 400)
      const c = normCode(body.einladungscode)
      const { error } = await db.from('verein')
        .update({ einladungscode: c, einladungscode_hash: await hashSecret(c) })
        .eq('id', body.verein_id)
      if (error) throw error
      return json({ ok: true, code: c })
    }

    if (action === 'reset_pin') {
      if (!body.username || !body.newPin) return json({ error: 'username + newPin nötig.' }, 400)
      const { error } = await db.from('benutzer')
        .update({ pin_hash: await hashSecret(body.newPin) })
        .eq('username', body.username)
      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: `Unbekannte Aktion: ${action}` }, 400)
  } catch (e) {
    return json({ error: `Serverfehler: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
