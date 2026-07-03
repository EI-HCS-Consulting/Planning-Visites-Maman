-- Ajout de photos dans le mur d'entraide (tasks) et le mur de soutien
-- (support_messages). Une photo par besoin / message, même logique que les
-- autres uploads (filename stocké en DB, fichier dans Storage).
alter table public.tasks
  add column if not exists photo text;

alter table public.support_messages
  add column if not exists photo text;

-- Buckets dédiés, même convention que "souvenirs" / "news-photos" / "patient-photos".
-- Les photos du mur d'entraide restent dans entraide-photos (PAS de copie vers
-- souvenirs). Les photos du mur de soutien sont copiées dans le bucket
-- "souvenirs" en plus d'être stockées ici (voir Soutien.tsx, syncPhotoToSouvenirs).
insert into storage.buckets (id, name, public)
values
  ('entraide-photos', 'entraide-photos', true),
  ('support-photos', 'support-photos', true)
on conflict (id) do nothing;

-- Mêmes policies permissives que les buckets existants (souvenirs, news-photos,
-- patient-photos) : pas d'auth visiteur côté Supabase, le contrôle d'accès
-- (PIN) est géré côté app.
create policy "Public read entraide-photos"
  on storage.objects for select
  using (bucket_id = 'entraide-photos');

create policy "Public insert entraide-photos"
  on storage.objects for insert
  with check (bucket_id = 'entraide-photos');

create policy "Public delete entraide-photos"
  on storage.objects for delete
  using (bucket_id = 'entraide-photos');

create policy "Public read support-photos"
  on storage.objects for select
  using (bucket_id = 'support-photos');

create policy "Public insert support-photos"
  on storage.objects for insert
  with check (bucket_id = 'support-photos');

create policy "Public delete support-photos"
  on storage.objects for delete
  using (bucket_id = 'support-photos');
