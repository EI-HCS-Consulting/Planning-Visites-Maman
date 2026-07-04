-- Ajout du pays (hôpital + domicile) — nécessaire pour les adresses hors
-- France, où Google Maps ajoute le pays comme segment distinct dans le lien.
alter table public.patient_spaces
  add column if not exists hospital_country text,
  add column if not exists home_country text;
