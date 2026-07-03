-- Permet d'ajouter une photo au moment de répondre à un besoin ("Je m'en
-- occupe"), en plus de la photo éventuelle du besoin lui-même (tasks.photo).
-- Même bucket que les autres photos d'entraide (entraide-photos).
alter table public.tasks
  add column if not exists claimed_photo text;
