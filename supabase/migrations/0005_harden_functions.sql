-- Sicherheits-Härtung: fester search_path für alle Funktionen
-- (verhindert search_path-Hijacking; empfohlen vom Supabase-Linter).
alter function app_teilnehmer() set search_path = public;
alter function app_verein() set search_path = public;
alter function app_haushalt() set search_path = public;
alter function app_is_admin() set search_path = public;
alter function punkte_fuer(int,int,int,int,phase,sieger) set search_path = public;
alter function tipps_neu_bewerten(uuid) set search_path = public;
alter function spiel_ergebnis_geaendert() set search_path = public;
alter function tipp_bewerten() set search_path = public;
alter function verfolgt_max_drei() set search_path = public;

-- app_is_mine ist nur für RLS-Policies gedacht -> für anon nicht aufrufbar machen.
revoke execute on function app_is_mine(uuid) from anon;
