-- Split payment_remaining into three columns:
--   payment_remaining_venue (rename from payment_remaining)
--   payment_remaining_decor (new)
--   payment_remaining_ent   (new)

-- Rename existing column to preserve data
alter table public.events rename column payment_remaining to payment_remaining_venue;

-- Add the two new columns
alter table public.events add column if not exists payment_remaining_decor text;
alter table public.events add column if not exists payment_remaining_ent   text;
