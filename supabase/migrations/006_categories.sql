-- 006_categories.sql — Dynamic categories table
-- Run this in the Supabase SQL editor.

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  venue_id    text unique not null,
  name        text not null,
  short_code  text not null,
  color       text not null default '#999999',
  sub_venues  jsonb not null default '[]'::jsonb,
  category_type text not null default 'custom',
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Enable RLS
alter table categories enable row level security;

-- Allow all authenticated users to read categories
create policy "Anyone can read categories"
  on categories for select
  using (true);

-- Only admins can insert/update/delete (enforced at app level, but open for now)
create policy "Anyone can manage categories"
  on categories for all
  using (true)
  with check (true);

-- Seed the 9 existing categories
insert into categories (venue_id, name, short_code, color, sub_venues, category_type, is_active, sort_order) values
  ('ap',     'Ambria Pushpanjali',    'AP',    '#E0C84E', '["Amber Lawn","Glass House","Amber Lawn + Glass House","Amber Lawn + Carnelian Deck","Glass House + Half Lawn","Carnelian Deck","Full Venue"]'::jsonb, 'venue', true, 1),
  ('am',     'Ambria Manaktala',      'AM',    '#E08E45', '["Emerald Lawn","Emerald + Glass House","Emerald + Banana Tree","Emerald + Glass House + Banana","Alstonia Lawn","Alstonia + Banana Tree","Alstonia + Banana Tree + Emerald","Glass House","Banana Tree Lawn","Full Venue"]'::jsonb, 'venue', true, 2),
  ('ae',     'Ambria Exotica',        'AE',    '#B08560', '["Aura Lawn","Aura Glass House + Lawn","Aura Glasshouse","Valencia Glass House","Valencia Glass House + Lawn","Valencia Glass House + Lawn + Poolside","Valencia Lawn + Poolside","Full Venue"]'::jsonb, 'venue', true, 3),
  ('ar',     'Ambria Restro',         'AR',    '#6088B5', '["Restro-Lawn","Restro Glass House","Rooftop","Restro Lawn + Glass House","Restro Lawn + Rooftop","Full Venue"]'::jsonb, 'venue', true, 4),
  ('villa',  'Villa',                 'Villa', '#9A6BBE', '["AP Kothi","AM Kothi","AE Kothi","Sukoon"]'::jsonb,                                   'villa',   true, 5),
  ('add',    'Ambria Design & Decor', 'ADD',   '#5FA8C4', '[]'::jsonb,                                                                          'service', true, 6),
  ('ac',     'Ambria Cuisine',        'AC',    '#D8728A', '[]'::jsonb,                                                                          'service', true, 7),
  ('aee',    'Ambria Events',         'AEE',   '#AD7EA5', '[]'::jsonb,                                                                          'service', true, 8),
  ('tender', 'Tender',                'TND',   '#68B078', '[]'::jsonb,                                                                          'tender',  true, 9)
on conflict (venue_id) do nothing;
