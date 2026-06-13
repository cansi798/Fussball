-- WM 2026 Tippspiel – Schema
-- Enums, Tabellen, Constraints, Indizes

create extension if not exists pgcrypto;

-- ---------- Enums ----------
do $$ begin
  create type rolle as enum ('kind', 'elternteil', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type phase as enum ('gruppe', 'ko');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sieger as enum ('heim', 'gast');
exception when duplicate_object then null; end $$;

-- ---------- Vereine ----------
create table if not exists verein (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kuerzel text not null,
  einladungscode_hash text not null,
  erstellt_am timestamptz not null default now()
);

-- ---------- Teilnehmer (Spieler) ----------
create table if not exists teilnehmer (
  id uuid primary key default gen_random_uuid(),
  verein_id uuid not null references verein(id) on delete cascade,
  vorname text not null,
  nachname text,
  rolle rolle not null,
  haushalt text not null,
  geburtsjahr int,
  erstellt_am timestamptz not null default now()
);

-- ---------- Benutzer (Login; nicht jeder Spieler hat einen) ----------
create table if not exists benutzer (
  id uuid primary key default gen_random_uuid(),
  teilnehmer_id uuid not null references teilnehmer(id) on delete cascade,
  username text not null unique,
  pin_hash text not null,
  erstellt_am timestamptz not null default now()
);

-- ---------- Mannschaften (WM-Teams, kommen aus OpenLigaDB) ----------
create table if not exists mannschaft (
  id uuid primary key default gen_random_uuid(),
  openliga_team_id int unique,
  name text not null,
  kuerzel text,
  flagge_url text
);

-- ---------- Spiele ----------
create table if not exists spiel (
  id uuid primary key default gen_random_uuid(),
  openliga_match_id int unique,
  heim_id uuid references mannschaft(id),
  gast_id uuid references mannschaft(id),
  anstoss timestamptz not null,
  phase phase not null default 'gruppe',
  tore_heim int,                 -- Endstand nach Verlängerung (NULL = noch offen)
  tore_gast int,
  elfmeter_sieger sieger,        -- nur gesetzt, wenn per Elfmeter entschieden
  tv_sender text default 'MagentaTV',
  ist_beendet boolean not null default false
);

-- ---------- Tipps ----------
create table if not exists tipp (
  id uuid primary key default gen_random_uuid(),
  teilnehmer_id uuid not null references teilnehmer(id) on delete cascade,
  spiel_id uuid not null references spiel(id) on delete cascade,
  tipp_heim int not null,
  tipp_gast int not null,
  punkte int not null default 0,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  unique (teilnehmer_id, spiel_id)
);

-- ---------- Verfolgte Mannschaften (max. 3 pro Kind) ----------
create table if not exists verfolgt (
  id uuid primary key default gen_random_uuid(),
  teilnehmer_id uuid not null references teilnehmer(id) on delete cascade,
  mannschaft_id uuid not null references mannschaft(id) on delete cascade,
  unique (teilnehmer_id, mannschaft_id)
);

-- Max. 3 verfolgte Teams pro Spieler erzwingen
create or replace function verfolgt_max_drei() returns trigger as $$
begin
  if (select count(*) from verfolgt where teilnehmer_id = new.teilnehmer_id) >= 3 then
    raise exception 'Maximal 3 Mannschaften können verfolgt werden.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_verfolgt_max_drei on verfolgt;
create trigger trg_verfolgt_max_drei
  before insert on verfolgt
  for each row execute function verfolgt_max_drei();

-- ---------- Indizes ----------
create index if not exists idx_teilnehmer_verein on teilnehmer(verein_id);
create index if not exists idx_teilnehmer_haushalt on teilnehmer(haushalt);
create index if not exists idx_benutzer_teilnehmer on benutzer(teilnehmer_id);
create index if not exists idx_tipp_spiel on tipp(spiel_id);
create index if not exists idx_tipp_teilnehmer on tipp(teilnehmer_id);
create index if not exists idx_spiel_anstoss on spiel(anstoss);
create index if not exists idx_verfolgt_teilnehmer on verfolgt(teilnehmer_id);
