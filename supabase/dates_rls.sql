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

create table if not exists public.paintings (
  id uuid primary key,
  author text not null check (author in ('redas', 'migle')),
  image_data text not null,
  created_at timestamptz not null default now()
);

alter table public.paintings enable row level security;

drop policy if exists "remi paintings select anon" on public.paintings;
drop policy if exists "remi paintings insert anon" on public.paintings;

create policy "remi paintings select anon"
on public.paintings
for select
to anon
using (true);

create policy "remi paintings insert anon"
on public.paintings
for insert
to anon
with check (true);

create table if not exists public.notification_subscriptions (
  endpoint text primary key,
  viewer text not null check (viewer in ('redas', 'migle')),
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_subscriptions enable row level security;

drop policy if exists "remi notification subscriptions insert anon" on public.notification_subscriptions;
drop policy if exists "remi notification subscriptions update anon" on public.notification_subscriptions;
drop policy if exists "remi notification subscriptions select anon" on public.notification_subscriptions;

grant select, insert, update on public.notification_subscriptions to anon, authenticated;

create policy "remi notification subscriptions insert anon"
on public.notification_subscriptions
for insert
to anon, authenticated
with check (true);

create policy "remi notification subscriptions update anon"
on public.notification_subscriptions
for update
to anon, authenticated
using (true)
with check (true);

create policy "remi notification subscriptions select anon"
on public.notification_subscriptions
for select
to anon, authenticated
using (true);
