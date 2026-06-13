// Registrierung: Vereins-Einladungscode prüfen, Eltern-Login + Kinder anlegen,
// danach direkt ein Session-JWT für den Elternteil zurückgeben.
import { serviceClient, jwtSecret } from '../_shared/db.ts'
import { hashSecret, verifySecret, normCode } from '../_shared/crypto.ts'
import { signAppJwt } from '../_shared/jwt.ts'
import { json, handleOptions } from '../_shared/cors.ts'

interface KindInput {
  vorname: string
  nachname?: string
  geburtsjahr?: number
  eigenesLogin?: boolean
  username?: string
  pin?: string
}
interface RegisterInput {
  einladungscode: string
  username: string
  pin: string
  vorname: string
  nachname?: string
  haushalt: string
  kinder?: KindInput[]
}

function badPin(pin: string) {
  return !/^\d{4,8}$/.test(pin)
}
function badUser(u: string) {
  return !/^[a-zA-Z0-9_.-]{3,30}$/.test(u)
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt
  try {
    const body = (await req.json()) as RegisterInput
    if (!body.einladungscode || !body.username || !body.pin || !body.vorname || !body.haushalt) {
      return json({ error: 'Bitte alle Pflichtfelder ausfüllen.' }, 400)
    }
    if (badUser(body.username)) return json({ error: 'Benutzername: 3–30 Zeichen (Buchstaben/Zahlen/._-).' }, 400)
    if (badPin(body.pin)) return json({ error: 'PIN: 4–8 Ziffern.' }, 400)

    const db = serviceClient()
    const code = normCode(body.einladungscode)

    // Verein per Einladungscode finden (Hash-Vergleich über alle Vereine).
    const { data: vereine, error: vErr } = await db.from('verein').select('id, name, einladungscode_hash')
    if (vErr) throw vErr
    let verein: { id: string; name: string } | null = null
    for (const v of vereine ?? []) {
      if (await verifySecret(code, v.einladungscode_hash)) { verein = { id: v.id, name: v.name }; break }
    }
    if (!verein) return json({ error: 'Ungültiger Einladungscode.' }, 403)

    // Benutzername frei?
    const { data: exists } = await db.from('benutzer').select('id').eq('username', body.username).maybeSingle()
    if (exists) return json({ error: 'Benutzername ist bereits vergeben.' }, 409)

    // Elternteil (Spieler) anlegen
    const { data: eltern, error: eErr } = await db.from('teilnehmer').insert({
      verein_id: verein.id,
      vorname: body.vorname,
      nachname: body.nachname ?? null,
      rolle: 'elternteil',
      haushalt: body.haushalt.trim(),
    }).select('id').single()
    if (eErr) throw eErr

    // Eltern-Login
    const { data: bnz } = await db.from('benutzer').insert({
      teilnehmer_id: eltern.id,
      username: body.username,
      pin_hash: await hashSecret(body.pin),
    }).select('id').single()
    await db.from('teilnehmer').update({ benutzer_id: bnz!.id }).eq('id', eltern.id)

    // Kinder anlegen
    for (const k of body.kinder ?? []) {
      if (!k.vorname) continue
      const { data: kind, error: kErr } = await db.from('teilnehmer').insert({
        verein_id: verein.id,
        vorname: k.vorname,
        nachname: k.nachname ?? null,
        rolle: 'kind',
        haushalt: body.haushalt.trim(),
        geburtsjahr: k.geburtsjahr ?? null,
      }).select('id').single()
      if (kErr) throw kErr

      if (k.eigenesLogin && k.username && k.pin) {
        if (badUser(k.username) || badPin(k.pin)) {
          return json({ error: `Login für Kind ${k.vorname}: Benutzername/PIN ungültig.` }, 400)
        }
        const { data: dup } = await db.from('benutzer').select('id').eq('username', k.username).maybeSingle()
        if (dup) return json({ error: `Benutzername "${k.username}" ist bereits vergeben.` }, 409)
        const { data: kb } = await db.from('benutzer').insert({
          teilnehmer_id: kind.id,
          username: k.username,
          pin_hash: await hashSecret(k.pin),
        }).select('id').single()
        await db.from('teilnehmer').update({ benutzer_id: kb!.id }).eq('id', kind.id)
      }
    }

    // Optionales zweites Elternteil (Ehepartner), gleicher Haushalt.
    // Eigener Login ist optional: mit Login = unabhängig, ohne = wird mitverwaltet.
    const p = body.partner
    if (p && p.vorname) {
      const { data: pt, error: ptErr } = await db.from('teilnehmer').insert({
        verein_id: verein.id, vorname: p.vorname, nachname: p.nachname ?? null,
        rolle: 'elternteil', haushalt: body.haushalt.trim(),
      }).select('id').single()
      if (ptErr) throw ptErr
      if (p.username && p.pin) {
        if (badUser(p.username) || badPin(p.pin)) return json({ error: 'Zweites Elternteil: Benutzername (3–30) / PIN (4–8 Ziffern) ungültig.' }, 400)
        const { data: dup } = await db.from('benutzer').select('id').eq('username', p.username).maybeSingle()
        if (dup) return json({ error: `Benutzername "${p.username}" ist bereits vergeben.` }, 409)
        const { data: pb } = await db.from('benutzer').insert({
          teilnehmer_id: pt.id, username: p.username, pin_hash: await hashSecret(p.pin),
        }).select('id').single()
        await db.from('teilnehmer').update({ benutzer_id: pb!.id }).eq('id', pt.id)
      }
    }

    // Direkt einloggen: JWT für den Elternteil
    const token = await signAppJwt({
      teilnehmer_id: eltern.id,
      verein_id: verein.id,
      rolle: 'elternteil',
      haushalt: body.haushalt.trim(),
      vorname: body.vorname,
    }, jwtSecret())

    const memberships = [{
      teilnehmer_id: eltern.id, verein_id: verein.id, verein: verein.name,
      rolle: 'elternteil', haushalt: body.haushalt.trim(), vorname: body.vorname,
    }]
    return json({ token, verein: verein.name, vorname: body.vorname, rolle: 'elternteil', memberships })
  } catch (e) {
    return json({ error: `Serverfehler: ${e instanceof Error ? e.message : String(e)}` }, 500)
  }
})
