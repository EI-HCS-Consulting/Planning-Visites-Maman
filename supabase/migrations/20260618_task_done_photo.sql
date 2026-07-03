-- Photo optionnelle ajoutée au moment de marquer un besoin comme "Fait"
-- (ex: preuve du repas livré, des affaires déposées...). Même bucket que
-- les autres photos d'entraide (entraide-photos).
alter table public.tasks
  add column if not exists done_photo text;
