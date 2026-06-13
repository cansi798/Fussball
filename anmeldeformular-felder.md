# Registrierungsformular (in der Web-App) – welche Felder es braucht

Die Familien registrieren sich **selbst** über ein Formular **in der Web-App**.
Den Zugang steuerst du über den **Vereins-Einladungscode**: nur wer einen gültigen
Code eingibt, kommt rein. So ist gesichert, dass „nur die rein, die dürfen".

> **Was du als Admin vorher tust:** je Verein **einen Einladungscode** anlegen
> (z. B. `FCB-2026`) und ihn an die richtigen Leute geben.
>
> **Login:** Jeder legt sich bei der Registrierung **Benutzername + PIN** selbst an
> und loggt sich später damit ein.
>
> **Lieblingsmannschaften** (max. 3 pro Kind) gehören **nicht** ins Formular —
> jedes Kind wählt sie später selbst in der App aus.

---

## Schritt 1 – Verein freischalten

| Feld                  | Pflicht | Beispiel    | Hinweis |
|-----------------------|:------:|--------------|---------|
| Vereins-Einladungscode| ✅     | `FCB-2026`   | Türsteher: bestimmt automatisch den Verein. Ungültig → keine Registrierung |

---

## Schritt 2 – Elternteil anlegen (das eigene Login)

| Feld          | Pflicht | Beispiel        | Hinweis |
|---------------|:------:|------------------|---------|
| Benutzername  | ✅     | `sabine_m`       | Frei wählbar, eindeutig; dient dem Login |
| PIN           | ✅     | `1234`           | Einfaches Geheimnis (z. B. 4–6 Ziffern) |
| Vorname       | ✅     | `Sabine`         | Anzeigename in der Eltern-Tabelle |
| Nachname      | ⬜     | `Müller` / `M.`  | Optional; Anfangsbuchstabe reicht |
| Haushalt/Familie | ✅  | `Familie Müller` | Verbindet Eltern & Kinder; **2. Elternteil gibt denselben Wert ein** |

---

## Schritt 3 – Kinder hinzufügen (beliebig viele)

Pro Kind:

| Feld          | Pflicht | Beispiel    | Hinweis |
|---------------|:------:|--------------|---------|
| Vorname       | ✅     | `Mia`        | Anzeigename in der Kinder-Tabelle |
| Nachname      | ⬜     | `M.`         | Optional |
| Geburtsjahr   | ⬜     | `2015`       | Optional (für Altersgruppen) |
| Eigenes Login?| ✅     | `Ja` / `Nein`| **Ja** → Kind bekommt eigenen Benutzername + PIN (ältere Kinder). **Nein** → Eltern tippen für das Kind (jüngere) |
| → Benutzername| (wenn „Ja") | `mia_m` | Nur falls eigenes Login |
| → PIN         | (wenn „Ja") | `4321`  | Nur falls eigenes Login |

---

## Wichtige Hinweise
- **Der Verein wird NICHT eingegeben** – er ergibt sich aus dem Einladungscode.
- **Zwei Elternteile:** Der zweite registriert sich separat mit demselben
  Einladungscode und demselben **Haushalt**-Wert → beide sind mit denselben Kindern
  verknüpft und können für sie tippen.
- **Jedes Kind ist ein eigener Spieler** mit eigener Punktzahl in der Tabelle,
  egal ob es selbst oder ein Elternteil tippt.

---

## Ablauf in Kürze
1. Du legst pro Verein einen Einladungscode an und verteilst ihn.
2. Elternteil öffnet die App → „Registrieren" → Code eingeben.
3. Code gültig → Benutzername + PIN anlegen, Kinder hinzufügen.
4. Fertig – ab sofort Login mit Benutzername + PIN, sichtbar nur der eigene Verein.
