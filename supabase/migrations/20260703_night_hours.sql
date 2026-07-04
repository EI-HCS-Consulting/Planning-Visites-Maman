-- Heures de nuitée configurables par l'admin (au lieu du 18h -> 11h fixe).
-- Défaut 19h -> 8h pour les espaces existants (modifiable ensuite en Paramètres).

alter table public.slot_config
  add column if not exists night_start_hour integer not null default 19,
  add column if not exists night_end_hour integer not null default 8;
