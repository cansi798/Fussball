// Login: Benutzername + PIN prüfen, Session-JWT mit RLS-Claims zurückgeben.
import { serviceClient, jwtSecret } from '../_shared/db.ts'
import { verifySecret } from '../_shared/crypto.ts'
import { signAppJwt } from '../_shared/jwt.ts'
import { json, handleOptions } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const { username, pin } = await req.json()
    if (!username || !pin) return json({ error: 'Benutzername und PIN erforderlich.' }, 400)

    const db = serviceClient()
    const { data: user } = await db
      .from('benutzer')
      .select('id, pin_hash, teilnehmer:teilnehmer_id ( id, verein_id, rolle, haushalt, vorname, verein:verein_id ( name ) )')
      .eq('username', username)
      .maybeSingle()

    // Generische Fehlermeldung (kein Nutzer-Enumeration-Leak)
    const fail = () => json({ error: 'Benutzername oder PIN ist falsch.' }, 401)
    if (!user) return fail()
    if (!(await verifySecret(pin, user.pin_hash))) return fail()

    const tn = (user as any).teilnehmer
    const token = await signAppJwt({
      teilnehmer_id: tn.id,
      verein_id: tn.verein_id,
      rolle: tn.rolle,
      haushalt: tn.haushalt,
      vorname: tn.vorname,
    }, jwtSecret())

    return json({
      token,
      vorname: tn.vorname,
      rolle: tn.rolle,
      verein: tn.verein?.name ?? null,
      teilnehmer_id: tn.id,
      verein_id: tn.verein_id,
      haushalt: tn.haushalt,
    })
  } catch (e) {
    return json({ error: `Serverfehler: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
