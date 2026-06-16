-- Allow an authenticated admin to create their own patient space + slot
-- config directly from the app (in-app onboarding, no web step required).
--
-- Run this once in the Supabase SQL editor (or `supabase db push` once you
-- have DB credentials linked locally). Safe to re-run: each policy is
-- dropped before being recreated.
--
-- NOTE: this only adds INSERT policies. It assumes SELECT/UPDATE policies
-- scoped to admin_id = auth.uid() already exist (the app already relies on
-- them for login/dashboard/settings) — adjust if that's not the case.

-- ── patient_spaces ──────────────────────────────────────────────────────────
drop policy if exists "admins can insert own space" on public.patient_spaces;

create policy "admins can insert own space"
on public.patient_spaces
for insert
to authenticated
with check (admin_id = auth.uid());

-- ── slot_config ──────────────────────────────────────────────────────────
drop policy if exists "admins can insert own slot_config" on public.slot_config;

create policy "admins can insert own slot_config"
on public.slot_config
for insert
to authenticated
with check (
  exists (
    select 1 from public.patient_spaces s
    where s.id = slot_config.space_id
      and s.admin_id = auth.uid()
  )
);
