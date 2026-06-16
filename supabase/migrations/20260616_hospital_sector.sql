-- Nouveau champ "Service de l'hôpital" (ex: "Secteur A") affiché dans
-- SpaceHeader : {hospital_service} | {hospital_sector} | {hospital_room} · {hospital_name}
-- Distinct du champ hospital_service existant (ex: "NEUROLOGIE"), qui ne change pas.
alter table public.patient_spaces
  add column if not exists hospital_sector text;
