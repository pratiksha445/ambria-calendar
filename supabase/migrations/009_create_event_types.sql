-- Event types management table
create table if not exists public.event_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_event_types_sort on public.event_types(sort_order);

-- RLS — open anon policies matching existing pattern
alter table public.event_types enable row level security;

create policy "event_types_anon_select" on public.event_types for select to anon using (true);
create policy "event_types_anon_insert" on public.event_types for insert to anon with check (true);
create policy "event_types_anon_update" on public.event_types for update to anon using (true);
create policy "event_types_anon_delete" on public.event_types for delete to anon using (true);

-- Seed with default event types
insert into public.event_types (name, is_active, sort_order) values
  ('Anand Karaj',        true, 1),
  ('Anniversary',        true, 2),
  ('Baby Shower',        true, 3),
  ('Birthday',           true, 4),
  ('Cocktail',           true, 5),
  ('Conference',         true, 6),
  ('Corporate',          true, 7),
  ('Engagement',         true, 8),
  ('Exhibition',         true, 9),
  ('Haldi',              true, 10),
  ('Intimate Gathering', true, 11),
  ('Kirtan',             true, 12),
  ('Mehendi',            true, 13),
  ('Nikah',              true, 14),
  ('Proposal',           true, 15),
  ('Reception',          true, 16),
  ('Religious Event',    true, 17),
  ('Sagan',              true, 18),
  ('Social Gathering',   true, 19),
  ('Wedding',            true, 20),
  ('Other',              true, 21)
on conflict (name) do nothing;
