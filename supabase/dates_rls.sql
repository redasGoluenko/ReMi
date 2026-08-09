-- Remi temporary RLS setup for PIN-gated app without Supabase Auth.
-- Run this in Supabase SQL Editor.

alter table public.dates enable row level security;

drop policy if exists "remi dates select anon" on public.dates;
drop policy if exists "remi dates insert anon" on public.dates;
drop policy if exists "remi dates update anon" on public.dates;
drop policy if exists "remi dates delete anon" on public.dates;

create policy "remi dates select anon"
on public.dates
for select
to anon
using (true);

create policy "remi dates insert anon"
on public.dates
for insert
to anon
with check (true);

create policy "remi dates update anon"
on public.dates
for update
to anon
using (true)
with check (true);

create policy "remi dates delete anon"
on public.dates
for delete
to anon
using (true);
