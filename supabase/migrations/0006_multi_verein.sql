-- Ein Benutzer (Login) kann mehreren Vereinen angehören:
-- teilnehmer.benutzer_id verknüpft jedes Spieler-Profil mit einem Login.
-- (benutzer.teilnehmer_id bleibt als "primäres" Profil bestehen.)
alter table teilnehmer add column if not exists benutzer_id uuid references benutzer(id) on delete set null;

-- Bestehende Verknüpfungen aus benutzer.teilnehmer_id übernehmen
update teilnehmer t
set benutzer_id = b.id
from benutzer b
where b.teilnehmer_id = t.id and t.benutzer_id is null;

create index if not exists idx_teilnehmer_benutzer on teilnehmer(benutzer_id);
