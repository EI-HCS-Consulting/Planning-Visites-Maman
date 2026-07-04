-- Adresse dédiée au mode "Soin à domicile", distincte de l'adresse hôpital,
-- pour que chaque mode conserve et réaffiche sa propre adresse au switch.
alter table public.patient_spaces
  add column if not exists home_address text,
  add column if not exists home_maps_url text;
