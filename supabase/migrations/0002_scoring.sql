-- WM 2026 Tippspiel – Punkteberechnung
-- Regel: exakt = 3, genau eine Torzahl = 1, sonst 0.
-- K.o. + Elfmeterschießen: +1 Bonus, wenn der Tipp die weiterkommende
-- Mannschaft als Sieger hatte (Nicht-Unentschieden zugunsten des Siegers).
-- Verglichen wird immer der Stand NACH Verlängerung (tore_heim/tore_gast).

create or replace function punkte_fuer(
  p_tipp_h int, p_tipp_g int,
  p_real_h int, p_real_g int,
  p_phase phase, p_elfmeter sieger
) returns int
language plpgsql
immutable
as $$
declare
  treffer int := 0;
  basis int := 0;
  getippter_sieger sieger;
begin
  -- Kein Ergebnis vorhanden -> 0 Punkte
  if p_real_h is null or p_real_g is null then
    return 0;
  end if;

  if p_tipp_h = p_real_h then treffer := treffer + 1; end if;
  if p_tipp_g = p_real_g then treffer := treffer + 1; end if;

  basis := case treffer when 2 then 3 when 1 then 1 else 0 end;

  -- K.o.-Bonus
  if p_phase = 'ko' and p_elfmeter is not null then
    if p_tipp_h > p_tipp_g then getippter_sieger := 'heim';
    elsif p_tipp_g > p_tipp_h then getippter_sieger := 'gast';
    else getippter_sieger := null; -- Unentschieden getippt -> kein Sieger
    end if;

    if getippter_sieger is not null and getippter_sieger = p_elfmeter then
      basis := basis + 1;
    end if;
  end if;

  return basis;
end;
$$;

-- Alle Tipps eines Spiels neu bewerten
create or replace function tipps_neu_bewerten(p_spiel_id uuid) returns void
language plpgsql
as $$
begin
  update tipp t
  set punkte = punkte_fuer(t.tipp_heim, t.tipp_gast, s.tore_heim, s.tore_gast, s.phase, s.elfmeter_sieger)
  from spiel s
  where s.id = t.spiel_id and t.spiel_id = p_spiel_id;
end;
$$;

-- Trigger: Ergebnis eines Spiels ändert sich -> Tipps neu bewerten
create or replace function spiel_ergebnis_geaendert() returns trigger as $$
begin
  if new.tore_heim is distinct from old.tore_heim
     or new.tore_gast is distinct from old.tore_gast
     or new.elfmeter_sieger is distinct from old.elfmeter_sieger
     or new.phase is distinct from old.phase then
    perform tipps_neu_bewerten(new.id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_spiel_ergebnis on spiel;
create trigger trg_spiel_ergebnis
  after update on spiel
  for each row execute function spiel_ergebnis_geaendert();

-- Trigger: neuer/aktualisierter Tipp -> direkt korrekt bewerten
-- (i.d.R. 0, da vor Anpfiff getippt wird; sichert Konsistenz bei Nachträgen)
create or replace function tipp_bewerten() returns trigger as $$
declare s spiel%rowtype;
begin
  select * into s from spiel where id = new.spiel_id;
  new.punkte := punkte_fuer(new.tipp_heim, new.tipp_gast, s.tore_heim, s.tore_gast, s.phase, s.elfmeter_sieger);
  new.geaendert_am := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tipp_bewerten on tipp;
create trigger trg_tipp_bewerten
  before insert or update of tipp_heim, tipp_gast on tipp
  for each row execute function tipp_bewerten();
