-- Punkteregel erweitert (gestaffelt, höchste zutreffende Stufe):
--   exakt = 3, genau eine Torzahl = 2, richtige Tendenz = 1, sonst 0.
-- K.o. + Elfmeterschießen: +1 Bonus für richtig getippten Sieger (unverändert).
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
  tipp_tendenz text;
  real_tendenz text;
begin
  if p_real_h is null or p_real_g is null then
    return 0;
  end if;

  if p_tipp_h = p_real_h then treffer := treffer + 1; end if;
  if p_tipp_g = p_real_g then treffer := treffer + 1; end if;

  tipp_tendenz := case when p_tipp_h > p_tipp_g then 'h' when p_tipp_h < p_tipp_g then 'g' else 'd' end;
  real_tendenz := case when p_real_h > p_real_g then 'h' when p_real_h < p_real_g then 'g' else 'd' end;

  basis := case
    when treffer = 2 then 3
    when treffer = 1 then 2
    when tipp_tendenz = real_tendenz then 1
    else 0
  end;

  -- K.o.-Bonus
  if p_phase = 'ko' and p_elfmeter is not null then
    if p_tipp_h > p_tipp_g then getippter_sieger := 'heim';
    elsif p_tipp_g > p_tipp_h then getippter_sieger := 'gast';
    else getippter_sieger := null;
    end if;

    if getippter_sieger is not null and getippter_sieger = p_elfmeter then
      basis := basis + 1;
    end if;
  end if;

  return basis;
end;
$$;

-- Alle bestehenden Tipps mit der neuen Regel neu bewerten.
update tipp t
set punkte = punkte_fuer(t.tipp_heim, t.tipp_gast, s.tore_heim, s.tore_gast, s.phase, s.elfmeter_sieger)
from spiel s
where s.id = t.spiel_id;
