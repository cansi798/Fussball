-- WM 2026 Tippspiel – Ranglisten-View
-- security_invoker = on: die RLS des abfragenden Nutzers gilt, d.h. man sieht
-- nur die Rangliste des eigenen Vereins. Auswertung: Punkte, exakte Tipps,
-- Teiltreffer, abgegebene Tipps. Sortierung im Frontend.

create or replace view rangliste
with (security_invoker = on) as
select
  tn.id          as teilnehmer_id,
  tn.verein_id   as verein_id,
  tn.vorname     as vorname,
  tn.nachname    as nachname,
  tn.rolle       as rolle,
  tn.haushalt    as haushalt,
  coalesce(sum(t.punkte), 0) as punkte,
  count(t.id) filter (
    where s.ist_beendet
      and t.tipp_heim = s.tore_heim and t.tipp_gast = s.tore_gast
  ) as exakt,
  count(t.id) filter (
    where s.ist_beendet
      and not (t.tipp_heim = s.tore_heim and t.tipp_gast = s.tore_gast)
      and (t.tipp_heim = s.tore_heim or t.tipp_gast = s.tore_gast)
  ) as teiltreffer,
  count(t.id) as tipps_gesamt
from teilnehmer tn
left join tipp t  on t.teilnehmer_id = tn.id
left join spiel s on s.id = t.spiel_id
where tn.rolle <> 'admin'
group by tn.id, tn.verein_id, tn.vorname, tn.nachname, tn.rolle, tn.haushalt;

grant select on rangliste to authenticated;
