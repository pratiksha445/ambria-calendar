-- Ambria Calendar — initial events schema
-- Phase 2: flat events table backing all venue categories
-- (AP, AM, AE, AR, Villa, ADD, AC, AEE, TND) plus manual/CRM sync metadata.

create extension if not exists "pgcrypto";

create table if not exists public.events (
  id                 uuid primary key default gen_random_uuid(),

  -- Core
  title              text not null,
  venue_id           text not null, -- ap, am, ae, ar, villa, add, ac, aee, tender
  sub_venue          text,
  event_type         text,
  event_type_other   text, -- used when event_type = 'Other'
  event_type_text    text, -- free text (TND only)
  status             text not null default 'Confirmed', -- Confirmed, Tentative
  shift              text, -- Morning, Lunch, Sundowner, Dinner

  -- Dates / times
  date               date not null,
  end_date           date,
  time               time,

  -- Venue booking (AP/AM/AE/AR)
  booking_status     text, -- VMD, Only Rental, Rental + Decor, Rental + DJ, Rental + Add on Food
  menu_type          text, -- Veg, Non-Veg, Jain, Chaat
  menu_cat           text, -- MV, MNV, DMV, DMNV, MCV, MCNV, LV, LNV, Customised
  fp_status          text, -- Released, Delayed by guest, Not Released

  -- Guest / contact
  guest_name         text,
  phone              text,
  pax                text,
  sales_person       text,
  notes              text,

  -- External venue fields (ADD / AC / AEE / TND)
  venue_name         text,
  venue_type         text, -- Lawn, Banquet, Lawn + Bqt, Poolside
  location           text,

  -- Decor-specific (ADD)
  decor_type         text, -- Silver, Gold, Premium

  -- Villa stay fields
  check_in_date      date,
  check_out_date     date,
  check_in_time      time,
  check_out_time     time,
  pool_included      text,
  meal_included      text,
  added_service      text,

  -- Tender-specific
  tender_name        text,

  -- Sync / provenance
  source             text not null default 'manual', -- crm, manual
  crm_id             text unique, -- external CRM id, used for idempotent sync
  synced_at          timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Indexes — most queries filter by date range, then narrow by venue/source
create index if not exists events_date_idx        on public.events (date);
create index if not exists events_venue_id_idx    on public.events (venue_id);
create index if not exists events_source_idx      on public.events (source);
create index if not exists events_crm_id_idx      on public.events (crm_id) where crm_id is not null;

-- Keep updated_at fresh
create or replace function public.events_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.events_set_updated_at();

-- Row level security — open policies for now, we'll tighten in a later phase
alter table public.events enable row level security;

drop policy if exists "events_anon_select" on public.events;
create policy "events_anon_select"
  on public.events
  for select
  to anon
  using (true);

drop policy if exists "events_anon_insert" on public.events;
create policy "events_anon_insert"
  on public.events
  for insert
  to anon
  with check (true);
