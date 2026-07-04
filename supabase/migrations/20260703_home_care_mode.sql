-- Permet à l'admin de basculer un espace en mode "Soin à domicile" :
-- le bandeau masque alors nom/service/secteur/chambre et n'affiche
-- plus qu'une adresse classique + lien Google Maps.
alter table public.patient_spaces
  add column if not exists home_care_mode boolean not null default false;
