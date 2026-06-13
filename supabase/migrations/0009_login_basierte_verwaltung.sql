-- Korrektur zu 0007: Ein Elternteil/Admin darf nur für Mitglieder OHNE eigenen
-- Login tippen (loginlose Kinder/Partner) + sich selbst. Wer einen eigenen Login
-- hat (auch der Ehepartner), verwaltet ausschließlich sich selbst.
create or replace function app_is_mine(target uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select target = app_teilnehmer()
    or (
      coalesce(auth.jwt() ->> 'rolle', '') in ('elternteil', 'admin')
      and exists (
        select 1 from teilnehmer tn
        where tn.id = target
          and tn.benutzer_id is null
          and tn.haushalt = app_haushalt()
          and tn.verein_id = app_verein()
      )
    );
$$;
