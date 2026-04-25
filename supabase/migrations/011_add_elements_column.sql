-- Add elements column for entertainment multi-select (stored as text array)
alter table public.events add column if not exists elements text[];
