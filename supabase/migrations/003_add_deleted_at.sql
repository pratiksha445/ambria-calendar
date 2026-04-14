-- Phase 5: soft-delete support.
-- CRM events get a deleted_at timestamp instead of hard-delete,
-- so the row survives and the next CRM sync won't re-create it.

ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT null;

-- Allow soft-deleting CRM events (setting deleted_at via update).
-- The existing 002 policy already allows full update/delete on source='manual'.
drop policy if exists "events_anon_soft_delete" on public.events;
create policy "events_anon_soft_delete"
  on public.events
  for update
  to anon
  using (source != 'manual')
  with check (source != 'manual');
