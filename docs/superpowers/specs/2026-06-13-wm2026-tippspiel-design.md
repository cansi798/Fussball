# WM 2026 Tippspiel – Design / Spezifikation

**Datum:** 2026-06-13
**Status:** Entwurf zur Freigabe

Eine Web-App, mit der **Kinder und ihre Eltern** Ergebnisse der Fußball-WM 2026
tippen. Mehrere **Vereine** nehmen teil, jeder sieht nur seine eigenen
Teilnehmer. Du als Betreiber hast eine **private Admin-Ansicht** über alles.

---

## 1. Ziele & Kernfunktionen

- Teilnehmer tippen Spielergebnisse der WM 2026.
- Punktevergabe: **exakt richtig = 3**, **eine Mannschaft richtig = 1**, **sonst 0**.
- Ranglisten/Tabellen pro Verein, umschaltbar: **Gesamt / nur Kinder / nur Eltern**.
- **Spielplan** mit Tagesansicht, deutschem TV-Sender und Filter „nur meine Teams".
- **Vereins-Trennung:** Jeder Verein sieht nur die eigenen Teilnehmer.
- **Admin-Ansicht:** Du siehst alles und pflegst Teilnehmer/Ergebnisse.
- Jedes **Kind kann bis zu 3 WM-Mannschaften „verfolgen"** (Lieblingsteams).
- **Responsive Design:** optimiert für Handy, angepasst für Tablet & Desktop.

### Nicht im Umfang (bewusst weggelassen – YAGNI)
- Kein E-Mail-Login, keine Passwörter. **Self-Registrierung nur mit gültigem
  Vereins-Einladungscode** (kein offenes Anmelden).
- Kein öffentliches Chat/Forum, keine Push-Benachrichtigungen (vorerst).
- Keine Bezahlfunktion, keine mehrsprachige Oberfläche (nur Deutsch).

---

## 2. Architektur (Überblick)

```
┌──────────────────────────────┐        ┌─────────────────────────────────┐
│   GitHub Pages (statisch)     │ HTTPS  │             Supabase            │
│   React + Vite + Tailwind     │ ─────▶ │                                 │
│                               │        │  • Postgres-Datenbank           │
│   • Registrierung (mit Code)  │        │  • RLS (Sichtbarkeitsregeln)    │
│   • Login per Zugangscode     │        │  • Edge Function: register()    │
│   • Tipp-Ansicht (Spielkarten)│        │  • Edge Function: login()       │
│   • Tabellen (Kinder/Eltern)  │        │  • Edge Function: sync()        │
│   • Lieblingsteams-Ansicht    │        │  • DB-Trigger: Punkteberechnung │
│   • Admin-Bereich (privat)    │        └──────────────┬──────────────────┘
└──────────────────────────────┘                       │ bei Bedarf (on-demand)
                                                        ▼
                                          ┌──────────────────────────┐
                                          │  OpenLigaDB (kostenlos,   │
                                          │  ohne Schlüssel, „wm2026")│
                                          └──────────────────────────┘
```

**Prinzip:** Das Frontend enthält keine Geheimnisse und redet nur mit Supabase.
Supabase ist das „Gehirn": speichert Daten, erzwingt per **RLS** die Sichtbarkeit
und holt **bei Bedarf** (kein Cron!) Ergebnisse von OpenLigaDB. Sobald ein
Endergebnis vorliegt, berechnet ein **Datenbank-Trigger** automatisch die Punkte
aller betroffenen Tipps.

**Technik-Begründung:** React + Tailwind, weil sich UI-Bausteine (Spielkarte,
Tabellenzeile, Ansichts-Umschalter) wiederverwenden lassen und Tailwind die
angepassten Layouts für Handy/Tablet/Desktop sauber abbildet. Deployment als
statischer Build über **GitHub Actions** nach GitHub Pages.

---

## 3. Zugang & Rollen (ohne E-Mail)

**Kein E-Mail-Login.** Der Zugang läuft über:
- **Vereins-Einladungscode** (z. B. `FCB-2026`) – du legst pro Verein **einen**
  fest. „Türsteher" für die Registrierung.
- **Benutzername + PIN** – legt sich jeder bei der Registrierung **selbst** an;
  damit loggt man sich künftig ein. Einfach und kindgerecht.

**Wichtige Trennung:** *Login* (wer meldet sich an) und *Spieler* (wer steht mit
eigenen Punkten in der Tabelle) sind getrennt. Ein **Eltern-Login kann für mehrere
Spieler tippen** (sich selbst + die eigenen Kinder), jedes Kind hat aber seine
**eigene Punktzahl**.

**Registrierung (Self-Service):**
1. „Registrieren" → **Vereins-Einladungscode** eingeben. `register()` prüft ihn;
   ungültig → Abbruch („nur die rein, die dürfen"). Gültig → Verein steht fest.
2. Elternteil legt sich **Benutzername + PIN** an (wird Spieler mit Rolle `elternteil`).
3. Elternteil fügt seine **Kinder** hinzu (Name, optional Geburtsjahr). **Pro Kind**
   wählbar:
   - **eigenes Login** (Kind bekommt eigenen Benutzername + PIN – für ältere Kinder), oder
   - **nur über Eltern** (kein eigenes Login; Eltern tippen für das Kind – für jüngere).
4. Jedes Kind ist ein **eigener Spieler** mit eigener Punktzahl.

**Zwei Elternteile:** Der zweite Elternteil registriert sich separat mit demselben
Einladungscode und demselben **Haushalt** → eigener Benutzername+PIN, aber mit
denselben Kindern verknüpft. Beide können für die Haushalts-Kinder tippen.

**Login (später):** Benutzername + PIN → `login()` → Sitzung, fest mit Verein +
Rolle verknüpft. Danach Umschalter **„Tippen als …"** (sich selbst oder ein Kind
des Haushalts).

**Wer darf für wen tippen?** Ein Login darf tippen für: **sich selbst** und alle
**Kinder (`rolle = kind`) im selben Haushalt**. (Nicht für den anderen Elternteil.)

**Sicherheit:** Einladungscode und PINs werden in der DB **gehasht** gespeichert.

**Deine Admin-Aufgabe:** Vereine + je einen Einladungscode anlegen und verteilen.
Den Rest erledigen die Familien selbst.

| Rolle        | Rechte |
|--------------|--------|
| `kind`       | Tipps abgeben; eigenen Verein sehen; bis zu 3 Teams verfolgen |
| `elternteil` | Tipps abgeben; eigenen Verein sehen |
| `admin` (du) | alles sehen; Teilnehmer/Vereine/Ergebnisse pflegen; Codes erzeugen |

---

## 4. Datenmodell

```
verein ──1:n──► teilnehmer (Spieler) ──1:n──► tipp ──n:1──► spiel ──n:1──► mannschaft
                    │  │
                    │  └──0..1── benutzer (Login: Username + PIN)
                    └──n:m (max. 3, nur Kinder)──► verfolgt ──► mannschaft
```

> **Haushalt** (Textschlüssel) verbindet Eltern & Kinder einer Familie.
> Ein Eltern-Login darf für alle Kinder im selben Haushalt tippen.

### Tabellen (vereinfacht)

**verein**
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid | PK |
| name | text | z. B. „FC Beispiel" |
| kuerzel | text | z. B. „FCB" (Code-Präfix) |
| einladungscode_hash | text | gehashter Vereins-Einladungscode (Registrierungs-Türsteher) |

**teilnehmer**
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid | PK |
| verein_id | uuid | FK → verein |
| vorname | text | Anzeigename |
| nachname | text | optional |
| rolle | enum | `kind` / `elternteil` / `admin` |
| haushalt | text | verbindet Familie (Kind ↔ Elternteil); Basis fürs „für Kinder tippen" |
| geburtsjahr | int | optional, nur Kinder |

**benutzer** (Login – nicht jeder Spieler hat einen)
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid | PK |
| teilnehmer_id | uuid | FK → teilnehmer (der „eigene" Spieler dieses Logins) |
| username | text | eindeutig, selbst gewählt |
| pin_hash | text | gehashte PIN |

> Ein `benutzer` darf zusätzlich für alle `kind`-Spieler im **selben Haushalt**
> tippen (Regel im Backend, nicht als Spalte gespeichert). Kinder ohne eigenes
> Login haben keinen `benutzer`-Eintrag.

**mannschaft**
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid | PK |
| name | text | z. B. „Deutschland" |
| kuerzel | text | z. B. „GER" |
| flagge_url | text | optional |

**spiel**
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid | PK |
| openliga_match_id | int | Verknüpfung zur API (für Sync) |
| heim_id | uuid | FK → mannschaft |
| gast_id | uuid | FK → mannschaft |
| anstoss | timestamptz | **Tipp-Schluss** |
| phase | enum | `gruppe` / `ko` |
| tv_sender | text | dt. TV-Sender; **von uns vorbefüllt** aus dem bekannten Übertragungsplan (MagentaTV = alle Spiele; ARD/ZDF = Free-TV-Auswahl), admin überschreibbar |
| tore_heim | int | Endstand nach Verlängerung, anfangs NULL |
| tore_gast | int | dito |
| elfmeter_sieger | enum | `heim` / `gast` / NULL (nur bei Elfmeterschießen) |
| ist_beendet | bool | Ergebnis final? |

**tipp**
| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid | PK |
| teilnehmer_id | uuid | FK → teilnehmer |
| spiel_id | uuid | FK → spiel |
| tipp_heim | int | getippte Heimtore |
| tipp_gast | int | getippte Gasttore |
| punkte | int | automatisch berechnet (s. Abschnitt 5) |
| *unique* | | (teilnehmer_id, spiel_id) – ein Tipp pro Spiel |

**verfolgt**
| Spalte | Typ | Hinweis |
|---|---|---|
| teilnehmer_id | uuid | FK → teilnehmer (nur Kinder) |
| mannschaft_id | uuid | FK → mannschaft |
| *Constraint* | | max. 3 Einträge pro Kind (DB-seitig erzwungen) |

---

## 5. Punkteregeln

Vergleich des Tipps mit dem **Endstand nach Verlängerung** (`tore_heim`/`tore_gast`).

| Fall | Punkte |
|---|---|
| Beide Torzahlen exakt richtig | **3** |
| Genau eine der beiden Torzahlen richtig | **1** |
| Keine richtig | **0** |
| **K.o.-Bonus:** Spiel ging ins Elfmeterschießen **und** der Tipp hatte die weiterkommende Mannschaft als Sieger | **+1** zusätzlich |

### Beispiele
- Real `2:1`, Tipp `2:1` → 3 Punkte.
- Real `2:1`, Tipp `2:0` → 1 Punkt (Heim-2 stimmt).
- Real `2:1`, Tipp `0:1` → 1 Punkt (Gast-1 stimmt).
- Real `2:1`, Tipp `1:3` → 0 Punkte.
- K.o., Stand nach Verl. `1:1`, Elfmeter-Sieger Heim. Tipp `2:1` → 1 Punkt (Gast-1 stimmt) **+1 Bonus** (Heim als Sieger getippt = weitergekommen) = **2 Punkte**.
- K.o., Stand nach Verl. `1:1`, Elfmeter-Sieger Heim. Tipp `1:1` → 3 Punkte (exakt), **kein** Bonus (Unentschieden getippt = kein Sieger).
- K.o., Stand nach Verl. `1:1`, Elfmeter-Sieger Heim. Tipp `1:2` → 1 Punkt (Heim-1 stimmt), **kein** Bonus (Gast als Sieger getippt = falscher Sieger).

### Regeln
- **Tipp-Schluss = Anstoß** des Spiels. Ein Tipp ist **nur möglich, solange
  `jetzt < Anstoß`** – also **vor Spielbeginn**. Während des Spiels und danach
  ist es gesperrt (per DB-Regel/Trigger, nicht nur im Frontend).
- **Änderbar:** Bis zum Anpfiff kann ein Tipp **beliebig oft geändert** werden;
  ab Anpfiff ist er **fix**.
- Das gilt **für alle gleich**, auch für **später Registrierte**: Auf bereits
  angepfiffene oder beendete Spiele (Ergebnis schon bekannt/in Arbeit) kann
  **niemand mehr** tippen. Verpasste Spiele zählen als **kein Tipp = 0 Punkte**.
- Punkte werden über einen **DB-Trigger** neu berechnet, sobald sich
  `tore_heim`/`tore_gast`/`elfmeter_sieger`/`ist_beendet` eines Spiels ändern.
- Punktwerte sind als Konstanten hinterlegt und später leicht anpassbar.

---

## 6. Sichtbarkeit (Row Level Security)

| Wer | sieht |
|---|---|
| `kind` / `elternteil` | nur Teilnehmer & Tipps des **eigenen Vereins** |
| `admin` | **alle** Vereine, alle Teilnehmer, alle Tipps |

- Die Sitzung (aus `login()`) trägt `verein_id` + `rolle`. RLS-Policies filtern
  jede Abfrage automatisch danach.
- **Tabellen-Umschalter** (Gesamt / nur Kinder / nur Eltern) ist eine
  Anzeige-Filterung *innerhalb* des sichtbaren Vereins.
- Tipps anderer Teilnehmer werden erst **nach Anstoß** sichtbar (vorher sieht man
  nur die eigenen) – verhindert Abschreiben.

---

## 7. Ergebnis-Sync (kein Cron)

1. OpenLigaDB-Liga: `wm2026` (bzw. der vollständigste verfügbare Datensatz – wird
   bei der Umsetzung final gewählt). Kostenlos, ohne Schlüssel, CORS-fähig.
2. Eine Edge Function `sync()` wird **bei Bedarf** aufgerufen (App-Start /
   „Aktualisieren"-Knopf), holt Spielplan & Ergebnisse, schreibt neue Endergebnisse
   in `spiel`. Der Trigger berechnet danach die Punkte.
3. **Notfall-/Korrektur-Modus (wichtig):** Im Admin-Bereich kannst du jedes
   Ergebnis **manuell eintragen oder überschreiben** – nötig, weil die
   community-gepflegten API-Daten unvollständig/fehlerhaft sein können (geprüft:
   ein Datensatz hatte nur 64 statt 104 Spiele).

---

## 8. Bildschirme / Ansichten

- **Registrierung:** Vereins-Einladungscode → Benutzername + PIN anlegen → Kinder
  hinzufügen (je optional eigenes Login). Kindgerecht und schlicht.
- **Login:** Benutzername + PIN.
- **Tippen:** Liste/Karten der **kommenden** Spiele mit Eingabe Heim:Gast; bis
  Anpfiff änderbar, danach gesperrt; bereits gespielte Spiele sind nicht tippbar.
  Oben ein Umschalter **„Tippen als …"** (sich selbst oder ein Kind des Haushalts).
- **Tabellen (Ranglisten, je eigener Verein):** drei umschaltbare Ansichten, jeweils
  **nach Rang sortiert** mit Auswertung:
  - **Gesamt** – Kinder **und** Eltern zusammen.
  - **Nur Kinder** – nur die Kinder.
  - **Nur Eltern** – nur die Eltern.

  Spalten je Spieler: **Platz, Name, Gesamtpunkte**, dazu Auswertung (Anzahl
  exakter Tipps = 3 Pkt, Anzahl Teiltreffer = 1 Pkt, abgegebene Tipps).
  **Gleichstand:** mehr exakte Tipps zuerst, dann mehr Teiltreffer.
- **Spielplan:** Tag-für-Tag-Ansicht aller Spiele (Datum, Anstoß, Teams,
  **TV-Sender** in DE, Ergebnis/Status). Filter **„nur meine Teams"** zeigt nur
  Spiele der verfolgten Mannschaften.
- **Meine Teams (Kinder):** bis zu 3 Mannschaften wählen (Liste mit Flaggen),
  deren nächste Spiele/Ergebnisse hervorgehoben.
- **Admin (privat):** Vereine & Teilnehmer anlegen, Codes erzeugen/exportieren,
  Ergebnisse manuell pflegen, Gesamtübersicht über alle Vereine.

Alle Ansichten **mobile-first**, mit angepassten Layouts für Tablet & Desktop.

---

## 9. Risiken & offene Punkte

- **API-Datenqualität (OpenLigaDB):** schwankt, evtl. unvollständig/Platzhalter →
  abgesichert durch manuellen Admin-Modus.
- **Einladungscode-Verteilung:** Die Vereins-Einladungscodes müssen organisatorisch
  an die richtigen Leute gelangen (außerhalb der App).
- **PIN vergessen:** Nutzer müssen sich Benutzername + PIN merken; Zurücksetzen nur
  über den Admin-Bereich (kein E-Mail-Reset).
- **Doppelte Tipps für ein Kind:** Kind mit eigenem Login *und* Eltern können beide
  tippen → es zählt der letzte Tipp vor Anpfiff (ein Tipp pro Spiel & Spieler).
- **WM-Format 2026:** 48 Teams / 104 Spiele – Datenmodell ist darauf ausgelegt.
- **Eindeutige Mannschafts-Zuordnung** zwischen OpenLigaDB-Namen und unserer
  `mannschaft`-Tabelle muss beim Sync sauber gemappt werden.
- **TV-Sender-Daten:** OpenLigaDB liefert keine dt. TV-Infos. Wir **befüllen das
  Feld vor** aus dem bekannten deutschen Übertragungsplan: **MagentaTV = alle 104
  Spiele** (Basis), **ARD/ZDF = veröffentlichte Free-TV-Auswahl** (u. a.
  Eröffnungsspiel, deutsche Spiele, Halbfinals, Finale). Die genaue
  ARD/ZDF-Zuordnung wird beim Daten-Seeding aus der offiziellen Programmankündigung
  übernommen und **verifiziert**; der Admin kann jederzeit überschreiben.

---

## 10. Zusammenfassung der Entscheidungen

| Thema | Entscheidung |
|---|---|
| Registrierung | Self-Service-Formular, gesichert per Vereins-Einladungscode (1 pro Verein) |
| Login | Benutzername + PIN (selbst gewählt); Login getrennt vom Spieler |
| Familie | Eltern-Login tippt für sich + Kinder im selben Haushalt; pro Kind eigenes Login optional; 2 Eltern = 2 Logins |
| Punkte | exakt = 3, eine Mannschaft = 1, sonst 0 |
| K.o. | Stand nach Verlängerung; Elfmeter → +1 Bonus für richtigen Sieger |
| Tipp-Schluss | strikt vor Anstoß; bis dahin beliebig änderbar; gilt auch für später Registrierte (verpasst = 0) |
| Spieldaten | OpenLigaDB (ohne Schlüssel), on-demand Sync, manueller Notfall-Modus |
| Lieblingsteams | max. 3 pro Kind, Auswahl in der App |
| Sichtbarkeit | Verein-isoliert per RLS; Admin sieht alles |
| Tabellen | 3 Ranglisten je Verein: Gesamt / nur Kinder / nur Eltern, mit Auswertung + Gleichstand-Regel |
| Spielplan | Tag-für-Tag-Ansicht mit dt. TV-Sender (von uns vorbefüllt, admin überschreibbar); Filter „nur meine Teams" |
| Frontend | React + Vite + Tailwind, responsive, GitHub Pages |
| Backend | Supabase (Postgres, RLS, Edge Functions, Trigger) |
