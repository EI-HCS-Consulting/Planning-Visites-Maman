-- Décomposition des adresses (hôpital + domicile) en rue / complément / code
-- postal / ville, pour construire le lien Google Maps automatiquement
-- (plus de saisie manuelle du lien — cf. googleMapsSearchUrl dans lib/address.ts).
alter table public.patient_spaces
  add column if not exists hospital_address_line2 text,
  add column if not exists hospital_postal_code text,
  add column if not exists hospital_city text,
  add column if not exists home_address_line2 text,
  add column if not exists home_postal_code text,
  add column if not exists home_city text;
