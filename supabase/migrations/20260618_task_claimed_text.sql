-- Texte libre associé à la photo de prise en charge d'un besoin
-- ("Je m'en occupe"), affiché sous la photo dans Entraide.tsx.
alter table public.tasks
  add column if not exists claimed_text text;
