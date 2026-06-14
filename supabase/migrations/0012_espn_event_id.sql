-- K.o.-Spiele werden aus ESPN gepflegt (OpenLigaDB hat sie nicht). Eigener
-- Schlüssel, damit sie nicht mit den OpenLigaDB-Gruppenspielen kollidieren
-- (zwei Teams können in Gruppe UND K.o. aufeinandertreffen).
alter table spiel add column if not exists espn_event_id bigint unique;
