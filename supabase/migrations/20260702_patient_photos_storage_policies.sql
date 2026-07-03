-- Policies Storage manquantes pour le bucket patient-photos.
-- Les autres buckets (souvenirs, news-photos, entraide-photos, support-photos)
-- ont été créés avec leurs policies dans des migrations précédentes.
-- patient-photos existait déjà en DB mais sans aucune policy → toute
-- opération échouait avec "New row violates row-level security policies".
--
-- upsert: true dans handlePhotoUpload déclenche un UPDATE si le fichier
-- existe déjà → policy UPDATE requise en plus de INSERT.

insert into storage.buckets (id, name, public)
values ('patient-photos', 'patient-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read patient-photos"   on storage.objects;
drop policy if exists "Public insert patient-photos" on storage.objects;
drop policy if exists "Public update patient-photos" on storage.objects;
drop policy if exists "Public delete patient-photos" on storage.objects;

create policy "Public read patient-photos"
  on storage.objects for select
  using (bucket_id = 'patient-photos');

create policy "Public insert patient-photos"
  on storage.objects for insert
  with check (bucket_id = 'patient-photos');

create policy "Public update patient-photos"
  on storage.objects for update
  using (bucket_id = 'patient-photos')
  with check (bucket_id = 'patient-photos');

create policy "Public delete patient-photos"
  on storage.objects for delete
  using (bucket_id = 'patient-photos');
