-- Einladungscode zusätzlich im Klartext speichern, damit der Admin ihn jederzeit
-- anzeigen/teilen kann (Verteil-Code, kein Passwort). Hash bleibt für die Prüfung.
alter table verein add column if not exists einladungscode text;
