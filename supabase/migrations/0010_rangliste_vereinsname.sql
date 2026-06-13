-- Rangliste: Vereinsname ergänzen (für Admin-Filter), haushalt entfernen (Datenschutz)
drop view if exists rangliste;
create view rangliste
with (security_invoker = on) as
select
  tn.id          as teilnehmer_id,
  tn.verein_id   as verein_id,
  v.name         as verein,
  tn.vorname     as vorname,
  tn.nachname    as nachname,
  tn.rolle       as rolle,
  coalesce(sum(t.punkte), 0) as punkte,
  count(t.id) filter (
    where s.ist_beendet and t.tipp_heim = s.tore_heim and t.tipp_gast = s.tore_gast
  ) as exakt,
  count(t.id) filter (
    where s.ist_beendet
      and not (t.tipp_heim = s.tore_heim and t.tipp_gast = s.tore_gast)
      and (t.tipp_heim = s.tore_heim or t.tipp_gast = s.tore_gast)
  ) as teiltreffer,
  count(t.id) as tipps_gesamt
from teilnehmer tn
join verein v on v.id = tn.verein_id
left join tipp t  on t.teilnehmer_id = tn.id
left join spiel s on s.id = t.spiel_id
where tn.rolle <> 'admin'
group by tn.id, tn.verein_id, v.name, tn.vorname, tn.nachname, tn.rolle;

grant select on rangliste to authenticated;
