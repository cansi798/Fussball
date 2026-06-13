-- Eltern dürfen für ALLE im eigenen Haushalt tippen (Kinder UND der andere
-- Elternteil), damit Vater & Mutter füreinander tippen können.
-- Kinder-Logins weiterhin nur für sich selbst.
create or replace function app_is_mine(target uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select target = app_teilnehmer()
    or (
      coalesce(auth.jwt() ->> 'rolle', '') in ('elternteil', 'admin')
      and exists (
        select 1 from teilnehmer tn
        where tn.id = target
          and tn.haushalt = app_haushalt()
          and tn.verein_id = app_verein()
      )
    );
$$;
