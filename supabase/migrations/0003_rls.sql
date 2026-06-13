-- WM 2026 Tippspiel – Row Level Security
-- Die Session ist ein vom Edge-Function `login` signiertes JWT mit Claims:
--   teilnehmer_id, verein_id, rolle, haushalt  (role = 'authenticated')
-- Diese Helper lesen die Claims; die Policies erzwingen Vereins-Trennung,
-- "für eigene Kinder tippen" und die Tipp-Deadline (vor Anstoß).

-- ---------- Claim-Helper ----------
create or replace function app_teilnehmer() returns uuid
  language sql stable as $$ select nullif(auth.jwt() ->> 'teilnehmer_id','')::uuid $$;

create or replace function app_verein() returns uuid
  language sql stable as $$ select nullif(auth.jwt() ->> 'verein_id','')::uuid $$;

create or replace function app_haushalt() returns text
  language sql stable as $$ select auth.jwt() ->> 'haushalt' $$;

create or replace function app_is_admin() returns boolean
  language sql stable as $$ select coalesce(auth.jwt() ->> 'rolle','') = 'admin' $$;

-- Darf der aktuelle Login für diesen Spieler tippen?
-- = der Spieler selbst ODER ein Kind im selben Haushalt & Verein.
create or replace function app_is_mine(target uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select target = app_teilnehmer()
    or exists (
      select 1 from teilnehmer tn
      where tn.id = target
        and tn.rolle = 'kind'
        and tn.haushalt = app_haushalt()
        and tn.verein_id = app_verein()
    );
$$;

-- ---------- Grants (Zeilen werden durch RLS gefiltert) ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------- RLS aktivieren ----------
alter table verein     enable row level security;
alter table teilnehmer enable row level security;
alter table benutzer   enable row level security;
alter table mannschaft enable row level security;
alter table spiel      enable row level security;
alter table tipp       enable row level security;
alter table verfolgt   enable row level security;

-- ---------- verein ----------
drop policy if exists verein_select on verein;
create policy verein_select on verein for select
  using (id = app_verein() or app_is_admin());
drop policy if exists verein_admin on verein;
create policy verein_admin on verein for all
  using (app_is_admin()) with check (app_is_admin());

-- ---------- teilnehmer ----------
drop policy if exists teilnehmer_select on teilnehmer;
create policy teilnehmer_select on teilnehmer for select
  using (verein_id = app_verein() or app_is_admin());
drop policy if exists teilnehmer_admin on teilnehmer;
create policy teilnehmer_admin on teilnehmer for all
  using (app_is_admin()) with check (app_is_admin());

-- ---------- benutzer (nur Admin sieht/verändert; Login läuft über Edge Function) ----------
drop policy if exists benutzer_admin on benutzer;
create policy benutzer_admin on benutzer for all
  using (app_is_admin()) with check (app_is_admin());

-- ---------- mannschaft (alle eingeloggten dürfen lesen) ----------
drop policy if exists mannschaft_select on mannschaft;
create policy mannschaft_select on mannschaft for select
  using (app_teilnehmer() is not null or app_is_admin());
drop policy if exists mannschaft_admin on mannschaft;
create policy mannschaft_admin on mannschaft for all
  using (app_is_admin()) with check (app_is_admin());

-- ---------- spiel (alle eingeloggten dürfen lesen, Admin schreibt) ----------
drop policy if exists spiel_select on spiel;
create policy spiel_select on spiel for select
  using (app_teilnehmer() is not null or app_is_admin());
drop policy if exists spiel_admin on spiel;
create policy spiel_admin on spiel for all
  using (app_is_admin()) with check (app_is_admin());

-- ---------- tipp ----------
-- Lesen: eigener Verein; fremde Tipps erst nach Anstoß sichtbar.
drop policy if exists tipp_select on tipp;
create policy tipp_select on tipp for select using (
  app_is_admin() or (
    exists (select 1 from teilnehmer tn where tn.id = tipp.teilnehmer_id and tn.verein_id = app_verein())
    and (
      app_is_mine(tipp.teilnehmer_id)
      or (select anstoss from spiel where id = tipp.spiel_id) <= now()
    )
  )
);
-- Anlegen: nur für eigene Spieler und nur vor Anstoß.
drop policy if exists tipp_insert on tipp;
create policy tipp_insert on tipp for insert with check (
  app_is_mine(teilnehmer_id)
  and (select anstoss from spiel where id = spiel_id) > now()
);
-- Ändern: nur eigene Spieler, nur solange vor Anstoß.
drop policy if exists tipp_update on tipp;
create policy tipp_update on tipp for update
  using (app_is_mine(teilnehmer_id))
  with check (
    app_is_mine(teilnehmer_id)
    and (select anstoss from spiel where id = spiel_id) > now()
  );
drop policy if exists tipp_delete on tipp;
create policy tipp_delete on tipp for delete using (
  app_is_mine(teilnehmer_id)
  and (select anstoss from spiel where id = spiel_id) > now()
);

-- ---------- verfolgt ----------
drop policy if exists verfolgt_select on verfolgt;
create policy verfolgt_select on verfolgt for select using (
  app_is_admin()
  or exists (select 1 from teilnehmer tn where tn.id = verfolgt.teilnehmer_id and tn.verein_id = app_verein())
);
drop policy if exists verfolgt_insert on verfolgt;
create policy verfolgt_insert on verfolgt for insert
  with check (app_is_mine(teilnehmer_id));
drop policy if exists verfolgt_delete on verfolgt;
create policy verfolgt_delete on verfolgt for delete
  using (app_is_mine(teilnehmer_id));
