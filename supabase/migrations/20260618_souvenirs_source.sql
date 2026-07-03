-- Trace l'origine d'un souvenir copié depuis Nouvelles du jour ou le Mur de
-- soutien (bouton "Ajouter au mur de souvenirs"), pour permettre un lien
-- "Voir l'original" depuis la galerie Souvenirs. NULL pour les photos
-- uploadées directement dans Souvenirs (pas d'origine).
alter table public.souvenirs
  add column if not exists source_type text check (source_type in ('news', 'support')),
  add column if not exists source_id uuid;
