-- Live-Minute / Status-Text aus der ESPN-Echtzeitquelle (z. B. "67'", "HZ").
-- Nur während ein Spiel läuft gesetzt, sonst NULL.
alter table spiel add column if not exists live_minute text;
