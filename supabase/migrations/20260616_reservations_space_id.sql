-- BUG DE FOND : la table `reservations` n'a jamais eu de colonne `space_id`.
-- Elle date du tout premier MVP mono-patient ; tout le reste de l'app (admin
-- dashboard, calendrier/créneaux visiteur, SpaceContext, VisitorContext)
-- filtre déjà par space_id en supposant qu'elle existe. Résultat : toute
-- nouvelle réservation échoue avec "column reservations.space_id does not
-- exist", et les réservations existantes ne sont rattachées à aucun espace.
--
-- Run dans le SQL Editor Supabase.

alter table public.reservations
  add column if not exists space_id uuid references public.patient_spaces(id);

create index if not exists reservations_space_id_idx on public.reservations (space_id);

-- Les 3 lignes existantes (créées avant ce correctif, sans espace associé)
-- restent avec space_id = NULL — elles n'apparaîtront dans aucun espace
-- (comportement attendu, c'est de la donnée de test de l'ancien MVP).
