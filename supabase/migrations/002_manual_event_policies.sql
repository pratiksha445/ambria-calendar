-- Phase 5: allow anon UPDATE + DELETE on manual events only.
-- CRM rows (source != 'manual') remain read-only from the calendar UI.
-- The server-side guard in src/lib/events.js also filters on source='manual',
-- but RLS is the real line of defense.

drop policy if exists "events_anon_update_manual" on public.events;
create policy "events_anon_update_manual"
  on public.events
  for update
  to anon
  using (source = 'manual')
  with check (source = 'manual');

drop policy if exists "events_anon_delete_manual" on public.events;
create policy "events_anon_delete_manual"
  on public.events
  for delete
  to anon
  using (source = 'manual');
