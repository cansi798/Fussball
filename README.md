# ⚽ WM 2026 Tippspiel

Eine responsive Webapp, in der **Kinder & Eltern** die Ergebnisse der Fußball-WM
2026 tippen – getrennt nach Vereinen, mit Punktewertung, Ranglisten, Spielplan
(inkl. deutschem TV-Sender) und privatem Admin-Bereich.

- **Frontend:** React + Vite + TypeScript + Tailwind (statisch, GitHub Pages)
- **Backend:** Supabase (Postgres + RLS + Edge Functions)
- **Spieldaten:** [OpenLigaDB](https://www.openligadb.de) (kostenlos, ohne Schlüssel)

> Design & Anforderungen: `docs/superpowers/specs/2026-06-13-wm2026-tippspiel-design.md`
> Umsetzungsplan: `docs/superpowers/plans/2026-06-13-wm2026-tippspiel.md`
> Formularfelder: `anmeldeformular-felder.md`

---

## Punkteregeln
- **Exaktes Ergebnis = 3 Punkte**
- **Eine Mannschaft mit korrekter Torzahl = 1 Punkt**
- **Sonst = 0**
- **K.o.-Spiele:** gewertet wird der Stand **nach Verlängerung**; bei
  Elfmeterschießen gibt es **+1 Bonus**, wenn die weiterkommende Mannschaft als
  Sieger getippt war.
- Getippt wird **nur vor Anpfiff** (bis dahin beliebig änderbar).

---

## 1. Lokale Entwicklung

```bash
cp .env.example .env      # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY eintragen
npm install
npm test                  # Scoring-Tests
npm run dev               # http://localhost:5173
```

Die Supabase-Werte stehen im Dashboard unter **Project Settings → API**.

---

## 2. Supabase einrichten

Einmalig die [Supabase CLI](https://supabase.com/docs/guides/cli) installieren
und mit dem Projekt verbinden:

```bash
supabase login
supabase link --project-ref azbaavodhzakrrescosn
```

### a) Datenbank-Migrationen einspielen
```bash
supabase db push
```
Legt Tabellen, RLS-Policies, Scoring-Trigger und die Ranglisten-View an.

### b) Function-Secrets setzen
```bash
# APP_JWT_SECRET MUSS exakt das JWT-Secret des Projekts sein:
# Dashboard -> Project Settings -> API -> JWT Settings -> JWT Secret
supabase secrets set APP_JWT_SECRET="<DEIN_PROJEKT_JWT_SECRET>"

# Frei wählbares Geheimnis nur für die einmalige Admin-Einrichtung:
supabase secrets set SETUP_SECRET="<frei-waehlbar>"
```
> Wichtig: Ohne korrektes `APP_JWT_SECRET` akzeptiert Supabase die Login-Tokens
> nicht und die Sichtbarkeitsregeln (RLS) greifen nicht.

### c) Edge Functions deployen
```bash
supabase functions deploy register
supabase functions deploy login
supabase functions deploy sync
supabase functions deploy admin
```
`verify_jwt`-Einstellungen stehen in `supabase/config.toml`.

---

## 3. Ersteinrichtung (Admin)

1. App öffnen → Route **`/#/setup`**.
2. `SETUP_SECRET`, Admin-Benutzername + PIN eingeben → Admin-Konto wird angelegt
   und du bist eingeloggt.
3. Im **Admin-Bereich**:
   - **Verein anlegen** (Name, Kürzel, Einladungscode, z. B. `FCB-2026`).
   - **Spieldaten synchronisieren** (lädt Spielplan/Ergebnisse von OpenLigaDB).
4. **Einladungscode** an die Familien verteilen → sie registrieren sich selbst
   unter **`/#/registrieren`**.

---

## 4. GitHub Pages Deployment

Das Repo enthält einen Workflow (`.github/workflows/deploy.yml`), der bei jedem
Push auf `main` baut, testet und nach Pages deployt.

1. In den **Repo-Settings → Secrets and variables → Actions** anlegen:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. **Settings → Pages → Source = GitHub Actions** aktivieren.
3. Pushen:
   ```bash
   git push origin main
   ```
4. Seite läuft anschließend unter `https://cansi798.github.io/Fussball/`.

> `vite.config.ts` setzt `base = /Fussball/`. Liegt das Repo unter einem anderen
> Namen, dort anpassen.

---

## Projektstruktur

```
supabase/migrations/   SQL: Schema, Scoring, RLS, Views
supabase/functions/    Edge Functions: register, login, sync, admin
src/lib/               Scoring (+Tests), Supabase-Client, API, Typen
src/context/           AuthContext (Session + Client)
src/components/         UI-Bausteine (Team, SenderBadge, Layout, …)
src/pages/             Login, Register, Setup, Tippen, Spielplan, Tabellen,
                       MeineTeams, Admin
```

## Sicherheit (kurz)
- Kein E-Mail-Login. Registrierung nur mit gültigem **Vereins-Einladungscode**.
- Login per **Benutzername + PIN**; Edge Function signiert ein HS256-JWT mit
  RLS-Claims (`verein_id`, `teilnehmer_id`, `rolle`, `haushalt`).
- **Row Level Security** erzwingt: jeder sieht nur den eigenen Verein, Eltern
  tippen nur für ihre eigenen Kinder, Tipps nur vor Anpfiff.
- PINs & Codes werden mit PBKDF2-SHA256 **gehasht** gespeichert.
