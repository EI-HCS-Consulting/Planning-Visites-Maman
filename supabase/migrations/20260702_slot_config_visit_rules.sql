-- Ajout des règles de planification des visites :
-- allowed_weekdays : jours de la semaine autorisés (0=Dimanche JS, 1=Lundi, ..., 6=Samedi)
-- blocked_dates    : dates spécifiques bloquées (ISO 'YYYY-MM-DD')

ALTER TABLE public.slot_config
  ADD COLUMN IF NOT EXISTS allowed_weekdays integer[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],
  ADD COLUMN IF NOT EXISTS blocked_dates text[] NOT NULL DEFAULT ARRAY[]::text[];
