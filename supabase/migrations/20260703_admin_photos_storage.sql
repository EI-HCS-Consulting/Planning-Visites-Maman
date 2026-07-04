-- Bucket Storage pour la photo de profil de l'ADMIN (distincte de la photo
-- du patient, qui vit déjà dans le bucket patient-photos). Prénom/nom/PIN de
-- l'admin sont stockés dans auth.users.user_metadata (pas de migration DB
-- nécessaire pour ces champs-là) — seule la photo a besoin d'un bucket.
-- Même convention de policies que patient-photos (20260702).

insert into storage.buckets (id, name, public)
values ('admin-photos', 'admin-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read admin-photos"   on storage.objects;
drop policy if exists "Public insert admin-photos" on storage.objects;
drop policy if exists "Public update admin-photos" on storage.objects;
drop policy if exists "Public delete admin-photos" on storage.objects;

create policy "Public read admin-photos"
  on storage.objects for select
  using (bucket_id = 'admin-photos');

create policy "Public insert admin-photos"
  on storage.objects for insert
  with check (bucket_id = 'admin-photos');

create policy "Public update admin-photos"
  on storage.objects for update
  using (bucket_id = 'admin-photos')
  with check (bucket_id = 'admin-photos');

create policy "Public delete admin-photos"
  on storage.objects for delete
  using (bucket_id = 'admin-photos');
