-- Option : inclure la durée de visite dans l'intervalle entre créneaux.
-- false (défaut) : l'intervalle configuré (min_gap_minutes) est l'écart brut
--                   entre deux débuts de créneaux, indépendant de la durée.
-- true            : le prochain créneau démarre après slot_duration_minutes
--                   + min_gap_minutes (ex. 20 min de visite + 1h d'intervalle
--                   -> créneaux à 12h00, 13h20, 14h40, ...).

ALTER TABLE public.slot_config
  ADD COLUMN IF NOT EXISTS gap_includes_duration boolean NOT NULL DEFAULT false;
