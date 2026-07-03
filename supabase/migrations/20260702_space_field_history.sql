-- Historique horodaté des changements de chambre / service / secteur.
-- Chaque modification d'un de ces trois champs génère une ligne ici.

create table public.space_field_history (
  id          uuid        primary key default gen_random_uuid(),
  space_id    uuid        not null references public.patient_spaces(id) on delete cascade,
  field_name  text        not null, -- 'hospital_room' | 'hospital_service' | 'hospital_sector'
  old_value   text,
  new_value   text,
  changed_at  timestamptz not null default now()
);

alter table public.space_field_history enable row level security;

-- L'admin peut tout faire sur l'historique de son propre espace.
create policy "admin_manage_own_history"
  on public.space_field_history
  for all
  using (
    space_id in (
      select id from public.patient_spaces where admin_id = auth.uid()
    )
  );
